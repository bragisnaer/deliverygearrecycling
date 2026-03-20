'use server'

import { auth } from '@/auth'
import {
  db,
  intakeRecords,
  prisonFacilities,
  tenants,
  auditLog,
  withRLSContext,
} from '@repo/db'
import { isPersistentProblemMarket } from '@/lib/persistent-flag'
import { and, desc, eq, sql } from 'drizzle-orm'
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
  created_at: Date
}

export type QuarantinedIntake = {
  id: string
  reference: string
  facility_name: string
  client_name: string
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
    const baseQuery = tx
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
        created_at: intakeRecords.created_at,
      })
      .from(intakeRecords)
      .leftJoin(prisonFacilities, eq(prisonFacilities.id, intakeRecords.prison_facility_id))
      .leftJoin(tenants, eq(tenants.id, intakeRecords.tenant_id))
      .orderBy(intakeRecords.created_at)

    if (filter === 'discrepancy') {
      return baseQuery.where(eq(intakeRecords.discrepancy_flagged, true))
    }

    if (filter === 'quarantine') {
      return baseQuery.where(
        and(
          eq(intakeRecords.quarantine_flagged, true),
          eq(intakeRecords.quarantine_overridden, false)
        )
      )
    }

    if (filter === 'unexpected') {
      return baseQuery.where(eq(intakeRecords.is_unexpected, true))
    }

    // 'all' or undefined — no filter
    return baseQuery
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

    return (rows.rows ?? rows) as unknown as DiscrepancyByCountry[]
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

    return (rows.rows ?? rows) as unknown as DiscrepancyByProduct[]
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

    return (rows.rows ?? rows) as unknown as DiscrepancyByFacility[]
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

  const months = ((rows.rows ?? rows) as { month: string; rate: number }[]).map(
    (r) => ({ month: r.month, rate: Number(r.rate) })
  )

  const rates = months.map((m) => m.rate)
  const persistentFlag = isPersistentProblemMarket(rates)

  return { months, persistentFlag }
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
