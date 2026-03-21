'use server'

import { auth } from '@/auth'
import {
  db,
  intakeRecords,
  prisonFacilities,
  tenants,
  auditLog,
  pickups,
  transportBookings,
  transportProviders,
  processingReports,
  products,
  outboundDispatches,
  withRLSContext,
} from '@repo/db'
import { isPersistentProblemMarket } from '@/lib/persistent-flag'
import { validateVoidInput } from '@/lib/void-helpers'
import { assembleTraceabilityChain, type TraceabilityChain } from '@/lib/traceability'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Auth helpers ---

async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    throw new Error('Unauthorized: reco-admin role required')
  }
  const user = session.user
  return {
    ...user,
    sub: user.id!,
  }
}

// --- Types ---

export type IntakeQueueItem = {
  id: string
  reference: string
  facility_name: string
  client_name: string
  staff_name: string
  delivery_date: Date
  origin_market: string | null
  is_unexpected: boolean
  discrepancy_flagged: boolean
  quarantine_flagged: boolean
  quarantine_overridden: boolean
  is_imported: boolean
  created_at: Date
}

export type QuarantinedIntake = {
  id: string
  reference: string
  facility_name: string | null
  client_name: string | null
  staff_name: string
  delivery_date: Date
  origin_market: string | null
}

// --- Server Actions ---

/**
 * Get all intake records with optional filter for the ops queue.
 * Filter options: 'all' | 'discrepancy' | 'quarantine' | 'unexpected'
 */
export async function getIntakeQueue(
  filter?: 'all' | 'discrepancy' | 'quarantine' | 'unexpected'
): Promise<IntakeQueueItem[]> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    const whereCondition =
      filter === 'discrepancy'
        ? and(eq(intakeRecords.voided, false), eq(intakeRecords.discrepancy_flagged, true))
        : filter === 'quarantine'
          ? and(
              eq(intakeRecords.voided, false),
              eq(intakeRecords.quarantine_flagged, true),
              eq(intakeRecords.quarantine_overridden, false)
            )
          : filter === 'unexpected'
            ? and(eq(intakeRecords.voided, false), eq(intakeRecords.is_unexpected, true))
            : eq(intakeRecords.voided, false)

    return tx
      .select({
        id: intakeRecords.id,
        reference: intakeRecords.reference,
        facility_name: prisonFacilities.name,
        client_name: tenants.name,
        staff_name: intakeRecords.staff_name,
        delivery_date: intakeRecords.delivery_date,
        origin_market: intakeRecords.origin_market,
        is_unexpected: intakeRecords.is_unexpected,
        discrepancy_flagged: intakeRecords.discrepancy_flagged,
        quarantine_flagged: intakeRecords.quarantine_flagged,
        quarantine_overridden: intakeRecords.quarantine_overridden,
        is_imported: intakeRecords.is_imported,
        created_at: intakeRecords.created_at,
      })
      .from(intakeRecords)
      .leftJoin(prisonFacilities, eq(prisonFacilities.id, intakeRecords.prison_facility_id))
      .leftJoin(tenants, eq(tenants.id, intakeRecords.tenant_id))
      .where(whereCondition)
      .orderBy(intakeRecords.created_at) as unknown as Promise<IntakeQueueItem[]>
  })
}

/**
 * Get all quarantine-blocked intake records (quarantine_flagged=true and not yet overridden).
 */
export async function getQuarantinedIntakes(): Promise<QuarantinedIntake[]> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: intakeRecords.id,
        reference: intakeRecords.reference,
        facility_name: prisonFacilities.name,
        client_name: tenants.name,
        staff_name: intakeRecords.staff_name,
        delivery_date: intakeRecords.delivery_date,
        origin_market: intakeRecords.origin_market,
      })
      .from(intakeRecords)
      .leftJoin(prisonFacilities, eq(prisonFacilities.id, intakeRecords.prison_facility_id))
      .leftJoin(tenants, eq(tenants.id, intakeRecords.tenant_id))
      .where(
        and(
          eq(intakeRecords.voided, false),
          eq(intakeRecords.quarantine_flagged, true),
          eq(intakeRecords.quarantine_overridden, false)
        )
      )
      .orderBy(intakeRecords.created_at)
  })
}

/**
 * Override a quarantine block on an intake record.
 * Requires a reason of at least 10 characters.
 */
export async function overrideQuarantine(
  intakeRecordId: string,
  reason: string
): Promise<{ success: boolean } | { error: string }> {
  const user = await requireRecoAdmin()

  const validatedId = z.string().uuid().parse(intakeRecordId)

  if (!reason || reason.trim().length < 10) {
    return { error: 'Override reason must be at least 10 characters' }
  }

  // Verify record exists and is quarantine-flagged
  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: intakeRecords.id,
        quarantine_flagged: intakeRecords.quarantine_flagged,
        quarantine_overridden: intakeRecords.quarantine_overridden,
      })
      .from(intakeRecords)
      .where(eq(intakeRecords.id, validatedId))
      .limit(1)
  })

  const record = rows[0]
  if (!record) {
    return { error: 'Intake record not found' }
  }

  if (!record.quarantine_flagged) {
    return { error: 'Intake record is not quarantine-flagged' }
  }

  if (record.quarantine_overridden) {
    return { error: 'Quarantine has already been overridden for this record' }
  }

  await withRLSContext(user, async (tx) => {
    return tx
      .update(intakeRecords)
      .set({
        quarantine_overridden: true,
        quarantine_override_reason: reason.trim(),
        quarantine_overridden_by: user.id as unknown as string,
        quarantine_overridden_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(intakeRecords.id, validatedId))
  })

  revalidatePath('/intake')
  return { success: true }
}

// --- Discrepancy Dashboard Actions ---

export type DiscrepancyByCountry = {
  country: string
  total_deliveries: number
  flagged_count: number
  discrepancy_rate_pct: number
}

export type DiscrepancyByProduct = {
  product_name: string
  total_lines: number
  flagged_lines: number
  discrepancy_rate_pct: number
}

export type DiscrepancyByFacility = {
  facility_name: string
  total_deliveries: number
  flagged_count: number
  discrepancy_rate_pct: number
}

export type MonthlyDiscrepancyResult = {
  months: { month: string; rate: number }[]
  persistentFlag: boolean
}

/**
 * Aggregate discrepancy rates by origin market (country) over the last 6 months.
 * Single aggregate SQL query — no N+1.
 */
export async function getDiscrepancyByCountry(): Promise<DiscrepancyByCountry[]> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT
        ir.origin_market AS country,
        COUNT(*)::int AS total_deliveries,
        SUM(CASE WHEN ir.discrepancy_flagged THEN 1 ELSE 0 END)::int AS flagged_count,
        ROUND(
          100.0 * SUM(CASE WHEN ir.discrepancy_flagged THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0),
          1
        )::float AS discrepancy_rate_pct
      FROM intake_records ir
      WHERE ir.delivered_at >= NOW() - INTERVAL '6 months'
        AND ir.origin_market IS NOT NULL
      GROUP BY ir.origin_market
      ORDER BY discrepancy_rate_pct DESC
    `)

    return rows as unknown as DiscrepancyByCountry[]
  })
}

/**
 * Aggregate discrepancy rates by product over the last 6 months.
 * Single aggregate SQL query — no N+1.
 */
export async function getDiscrepancyByProduct(): Promise<DiscrepancyByProduct[]> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT
        p.name AS product_name,
        COUNT(*)::int AS total_lines,
        SUM(CASE WHEN il.discrepancy_pct IS NOT NULL AND il.discrepancy_pct > 0 THEN 1 ELSE 0 END)::int AS flagged_lines,
        ROUND(
          100.0 * SUM(CASE WHEN il.discrepancy_pct IS NOT NULL AND il.discrepancy_pct > 0 THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0),
          1
        )::float AS discrepancy_rate_pct
      FROM intake_lines il
      JOIN intake_records ir ON ir.id = il.intake_record_id
      JOIN products p ON p.id = il.product_id
      WHERE ir.delivered_at >= NOW() - INTERVAL '6 months'
      GROUP BY p.name
      ORDER BY discrepancy_rate_pct DESC
    `)

    return rows as unknown as DiscrepancyByProduct[]
  })
}

/**
 * Aggregate discrepancy rates by prison facility over the last 6 months.
 * Single aggregate SQL query — no N+1.
 */
export async function getDiscrepancyByFacility(): Promise<DiscrepancyByFacility[]> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    const rows = await tx.execute(sql`
      SELECT
        pf.name AS facility_name,
        COUNT(*)::int AS total_deliveries,
        SUM(CASE WHEN ir.discrepancy_flagged THEN 1 ELSE 0 END)::int AS flagged_count,
        ROUND(
          100.0 * SUM(CASE WHEN ir.discrepancy_flagged THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0),
          1
        )::float AS discrepancy_rate_pct
      FROM intake_records ir
      JOIN prison_facilities pf ON pf.id = ir.prison_facility_id
      WHERE ir.delivered_at >= NOW() - INTERVAL '6 months'
      GROUP BY pf.name
      ORDER BY discrepancy_rate_pct DESC
    `)

    return rows as unknown as DiscrepancyByFacility[]
  })
}

/**
 * Fetch monthly discrepancy rates for a specific country over the last 6 months,
 * then compute the persistent problem market flag via isPersistentProblemMarket().
 */
export async function getMonthlyDiscrepancyByCountry(
  country: string
): Promise<MonthlyDiscrepancyResult> {
  const user = await requireRecoAdmin()

  const validatedCountry = z.string().min(1).max(100).parse(country)

  const rows = await withRLSContext(user, async (tx) => {
    return tx.execute(sql`
      SELECT
        to_char(date_trunc('month', ir.delivered_at), 'YYYY-MM') AS month,
        ROUND(
          100.0 * SUM(CASE WHEN ir.discrepancy_flagged THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0),
          1
        )::float AS rate
      FROM intake_records ir
      WHERE ir.origin_market = ${validatedCountry}
        AND ir.delivered_at >= NOW() - INTERVAL '6 months'
      GROUP BY date_trunc('month', ir.delivered_at)
      ORDER BY date_trunc('month', ir.delivered_at) ASC
    `)
  })

  const months = (rows as unknown as { month: string; rate: number }[]).map(
    (r) => ({ month: r.month, rate: Number(r.rate) })
  )

  const rates = months.map((m) => m.rate)
  const persistentFlag = isPersistentProblemMarket(rates)

  return { months, persistentFlag }
}

// --- Void Actions (AUDIT-04) ---

/**
 * Void an intake record with a required reason.
 * Only reco-admin can void records. Voided records are excluded from all
 * list queries but remain visible in the audit trail (no deletion).
 */
export async function voidIntakeRecord(
  id: string,
  reason: string
): Promise<{ success: true } | { error: string }> {
  const user = await requireRecoAdmin()

  const validation = validateVoidInput(reason)
  if (!validation.valid) return { error: validation.error! }

  const rows = await withRLSContext(user, async (tx) =>
    tx
      .select({ voided: intakeRecords.voided })
      .from(intakeRecords)
      .where(eq(intakeRecords.id, id))
      .limit(1)
  )

  const record = rows[0]
  if (!record) return { error: 'not_found' }
  if (record.voided) return { error: 'already_voided' }

  await withRLSContext(user, async (tx) =>
    tx
      .update(intakeRecords)
      .set({ voided: true, void_reason: reason, updated_at: new Date() })
      .where(eq(intakeRecords.id, id))
  )

  revalidatePath('/intake')
  return { success: true }
}

// --- Edit Actions (AUDIT-01, AUDIT-03) ---

/**
 * Admin edit of an intake record — no 48-hour restriction (AUDIT-03).
 * Requires reco-admin role.
 */
export async function editIntakeRecordAdmin(
  id: string,
  updates: {
    staff_name?: string
    delivery_date?: Date
    origin_market?: string
    notes?: string
  }
): Promise<{ success: true } | { error: string }> {
  const user = await requireRecoAdmin()

  // No 48-hour check — AUDIT-03
  await withRLSContext(user, async (tx) =>
    tx
      .update(intakeRecords)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(intakeRecords.id, id))
  )

  return { success: true }
}

/**
 * Fetch edit history for any record from audit_log.
 * Uses raw db (no RLS) — audit_log has no RLS policies.
 * Filters to UPDATE actions only (INSERT/DELETE are not edits).
 */
export async function getEditHistory(
  tableName: string,
  recordId: string
) {
  await requireRecoAdmin()

  // Use raw db — audit_log has no RLS (accessible only via application queries)
  const entries = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.table_name, tableName),
        eq(auditLog.record_id, recordId),
        eq(auditLog.action, 'UPDATE')
      )
    )
    .orderBy(desc(auditLog.changed_at))

  return entries
}

// --- Traceability Chain (PROCESS-05) ---

/**
 * Assembles the full traceability chain for a given intake record.
 * Accessible by both reco-admin and prison staff.
 *
 * Dispatch resolution:
 *   1. Deterministic: outbound_dispatches WHERE intake_record_id = id AND voided = false
 *   2. Fallback: outbound_dispatches WHERE prison_facility_id = intake.prison_facility_id
 *              AND tenant_id = intake.tenant_id AND voided = false
 *
 * Uses raw db for cross-table reads — prison_role may lack policies on some tables.
 */
export async function getTraceabilityChain(intakeRecordId: string): Promise<TraceabilityChain> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const validatedId = z.string().uuid().parse(intakeRecordId)

  // 1. Fetch intake record
  const intakeRows = await db
    .select({
      id: intakeRecords.id,
      reference: intakeRecords.reference,
      staff_name: intakeRecords.staff_name,
      delivery_date: intakeRecords.delivery_date,
      is_unexpected: intakeRecords.is_unexpected,
      prison_facility_id: intakeRecords.prison_facility_id,
      tenant_id: intakeRecords.tenant_id,
      pickup_id: intakeRecords.pickup_id,
    })
    .from(intakeRecords)
    .where(eq(intakeRecords.id, validatedId))
    .limit(1)

  const intake = intakeRows[0]
  if (!intake) throw new Error('Intake record not found')

  const { pickup_id, ...intakeData } = intake
  const { prison_facility_id, tenant_id } = intake

  // 2. Fetch pickup + transport_booking if pickup_id is set
  let pickupData: TraceabilityChain['pickup'] = null
  let transportData: TraceabilityChain['transport'] = null

  if (pickup_id) {
    const pickupRows = await db
      .select({
        id: pickups.id,
        reference: pickups.reference,
        status: pickups.status,
        created_at: pickups.created_at,
      })
      .from(pickups)
      .where(eq(pickups.id, pickup_id))
      .limit(1)

    if (pickupRows[0]) {
      pickupData = pickupRows[0]

      // Fetch transport booking for this pickup
      const transportRows = await db
        .select({
          id: transportBookings.id,
          transport_type: transportBookings.transport_type,
          provider_name: transportProviders.name,
        })
        .from(transportBookings)
        .leftJoin(transportProviders, eq(transportProviders.id, transportBookings.transport_provider_id))
        .where(eq(transportBookings.pickup_id, pickup_id))
        .limit(1)

      if (transportRows[0]) {
        const tb = transportRows[0]
        // Derive a display status based on pickup status
        const pickupStatus = pickupData.status
        const displayStatus =
          pickupStatus === 'delivered' || pickupStatus === 'intake_registered' ? 'delivered' : 'in_transit'

        transportData = {
          id: tb.id,
          type: tb.transport_type,
          provider: tb.provider_name ?? undefined,
          status: displayStatus,
        }
      }
    }
  }

  // 3. Fetch wash reports for this intake_record_id, voided = false
  const washRows = await db
    .select({
      id: processingReports.id,
      staff_name: processingReports.staff_name,
      report_date: processingReports.report_date,
      product_name: products.name,
    })
    .from(processingReports)
    .leftJoin(products, eq(products.id, processingReports.product_id))
    .where(
      and(
        eq(processingReports.intake_record_id, validatedId),
        eq(processingReports.activity_type, 'wash'),
        eq(processingReports.voided, false)
      )
    )
    .orderBy(processingReports.created_at)

  const washReports = washRows.map((r) => ({
    id: r.id,
    staff_name: r.staff_name,
    report_date: r.report_date,
    product_name: r.product_name ?? '',
  }))

  // 4. Fetch pack reports for this intake_record_id, voided = false
  const packRows = await db
    .select({
      id: processingReports.id,
      staff_name: processingReports.staff_name,
      report_date: processingReports.report_date,
      product_name: products.name,
    })
    .from(processingReports)
    .leftJoin(products, eq(products.id, processingReports.product_id))
    .where(
      and(
        eq(processingReports.intake_record_id, validatedId),
        eq(processingReports.activity_type, 'pack'),
        eq(processingReports.voided, false)
      )
    )
    .orderBy(processingReports.created_at)

  const packReports = packRows.map((r) => ({
    id: r.id,
    staff_name: r.staff_name,
    report_date: r.report_date,
    product_name: r.product_name ?? '',
  }))

  // 5. Deterministic dispatch: outbound_dispatches WHERE intake_record_id = validatedId AND voided = false
  const directDispatchRows = await db
    .select({
      id: outboundDispatches.id,
      dispatch_date: outboundDispatches.dispatch_date,
      destination: outboundDispatches.destination,
      status: outboundDispatches.status,
    })
    .from(outboundDispatches)
    .where(
      and(
        eq(outboundDispatches.intake_record_id, validatedId),
        eq(outboundDispatches.voided, false)
      )
    )
    .limit(1)

  const directDispatch = directDispatchRows[0] ?? null

  // 6. Fallback dispatch: facility-level when no deterministic dispatch found
  let facilityDispatches: Array<{ id: string; dispatch_date: Date; destination: string; status: string }> = []

  if (!directDispatch) {
    const fallbackRows = await db
      .select({
        id: outboundDispatches.id,
        dispatch_date: outboundDispatches.dispatch_date,
        destination: outboundDispatches.destination,
        status: outboundDispatches.status,
      })
      .from(outboundDispatches)
      .where(
        and(
          eq(outboundDispatches.prison_facility_id, prison_facility_id),
          eq(outboundDispatches.tenant_id, tenant_id),
          eq(outboundDispatches.voided, false),
          isNull(outboundDispatches.intake_record_id)
        )
      )
      .orderBy(desc(outboundDispatches.dispatch_date))

    facilityDispatches = fallbackRows
  }

  return assembleTraceabilityChain({
    intake: intakeData,
    pickup: pickupData,
    transport: transportData,
    washReports,
    packReports,
    directDispatch,
    facilityDispatches,
  })
}
