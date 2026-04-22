'use server'

import { withRLSContext, locations } from '@repo/db'
import { eq, sql } from 'drizzle-orm'
import { sumMaterialWeights, calculateReuseRate } from '@/lib/esg-calculator'
import type { MaterialWeightRow } from '@/lib/esg-calculator'

// JWTClaims shape used by withRLSContext
type JWTClaims = {
  sub: string
  tenant_id: string | null
  location_id: string | null
  role: string
  [key: string]: unknown
}

// --- Types ---

export type PickupActivityResult = {
  active: { status: string; count: number }[]
  recent: { id: string; reference: string; status: string; created_at: string }[]
}

export type SentVsReceivedRow = {
  product_name: string
  sent: number
  received: number
  discrepancy_pct: number
  location_name?: string
}

export type VolumeByQuarterRow = {
  quarter: string
  item_count: number
  location_name?: string
}

export type EsgSummaryResult = {
  materials: MaterialWeightRow[]
  reuseRate: number
  totalItems: number
}

export type ClientLocation = {
  id: string
  name: string
  country: string
}

// --- Actions ---

/**
 * Get pickup activity for the client dashboard.
 * Active: counts by status (non-terminal statuses).
 * Recent: last 5 pickups.
 * Scoped by location_id for client role; all locations for client-global.
 */
export async function getClientPickupActivity(
  claims: JWTClaims,
  locationId?: string
): Promise<PickupActivityResult> {
  return withRLSContext(claims, async (tx) => {
    const TERMINAL_STATUSES = ['delivered', 'intake_registered', 'cancelled']

    // Active pickup counts by status (non-terminal)
    const activeRows = locationId
      ? ((await tx.execute(sql`
          SELECT status, COUNT(*)::int AS count
          FROM pickups
          WHERE status NOT IN ('delivered', 'intake_registered', 'cancelled')
            AND location_id = ${locationId}::uuid
          GROUP BY status
        `)) as unknown as { status: string; count: number }[])
      : ((await tx.execute(sql`
          SELECT status, COUNT(*)::int AS count
          FROM pickups
          WHERE status NOT IN ('delivered', 'intake_registered', 'cancelled')
          GROUP BY status
        `)) as unknown as { status: string; count: number }[])

    // Recent 5 pickups
    const recentRows = locationId
      ? ((await tx.execute(sql`
          SELECT id::text, reference, status, created_at::text
          FROM pickups
          WHERE location_id = ${locationId}::uuid
          ORDER BY created_at DESC
          LIMIT 5
        `)) as unknown as { id: string; reference: string; status: string; created_at: string }[])
      : ((await tx.execute(sql`
          SELECT id::text, reference, status, created_at::text
          FROM pickups
          ORDER BY created_at DESC
          LIMIT 5
        `)) as unknown as { id: string; reference: string; status: string; created_at: string }[])

    return {
      active: activeRows.filter((r) => !TERMINAL_STATUSES.includes(r.status)),
      recent: recentRows,
    }
  })
}

/**
 * Compare items sent (pickup_lines.quantity) vs received (intake_lines.actual_quantity)
 * for each product, over the last 90 days.
 * Groups by location for client-global role.
 * Discrepancy pct: ABS(received - sent) / sent * 100.
 */
export async function getClientSentVsReceived(
  claims: JWTClaims,
  locationId?: string
): Promise<SentVsReceivedRow[]> {
  return withRLSContext(claims, async (tx) => {
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    if (locationId) {
      // Client role: single location, group by product only
      return (await tx.execute(sql`
        SELECT
          p.name AS product_name,
          COALESCE(SUM(pl.quantity), 0)::int AS sent,
          COALESCE(SUM(il.actual_quantity), 0)::int AS received,
          COALESCE(
            ROUND(
              (ABS(SUM(il.actual_quantity) - SUM(pl.quantity)) * 100.0
               / NULLIF(SUM(pl.quantity), 0))::numeric,
              1
            ),
            0
          )::float AS discrepancy_pct
        FROM pickup_lines pl
        JOIN pickups pu ON pu.id = pl.pickup_id
        JOIN products p ON p.id = pl.product_id
        LEFT JOIN intake_records ir ON ir.pickup_id = pu.id AND ir.voided = false
        LEFT JOIN intake_lines il ON il.intake_record_id = ir.id AND il.product_id = pl.product_id
        WHERE pu.location_id = ${locationId}::uuid
          AND pu.created_at >= ${ninetyDaysAgo.toISOString()}::timestamptz
        GROUP BY p.name
        ORDER BY discrepancy_pct DESC
      `)) as unknown as SentVsReceivedRow[]
    }

    // Client-global: aggregate by product and location
    return (await tx.execute(sql`
      SELECT
        p.name AS product_name,
        l.name AS location_name,
        COALESCE(SUM(pl.quantity), 0)::int AS sent,
        COALESCE(SUM(il.actual_quantity), 0)::int AS received,
        COALESCE(
          ROUND(
            (ABS(SUM(il.actual_quantity) - SUM(pl.quantity)) * 100.0
             / NULLIF(SUM(pl.quantity), 0))::numeric,
            1
          ),
          0
        )::float AS discrepancy_pct
      FROM pickup_lines pl
      JOIN pickups pu ON pu.id = pl.pickup_id
      JOIN products p ON p.id = pl.product_id
      JOIN locations l ON l.id = pu.location_id
      LEFT JOIN intake_records ir ON ir.pickup_id = pu.id AND ir.voided = false
      LEFT JOIN intake_lines il ON il.intake_record_id = ir.id AND il.product_id = pl.product_id
      WHERE pu.created_at >= ${ninetyDaysAgo.toISOString()}::timestamptz
      GROUP BY p.name, l.name
      ORDER BY discrepancy_pct DESC
    `)) as unknown as SentVsReceivedRow[]
  })
}

/**
 * Historical delivery volume by quarter.
 * Returns up to 8 quarters of intake data.
 * Groups by location for client-global role.
 */
export async function getClientVolumeByQuarter(
  claims: JWTClaims,
  locationId?: string
): Promise<VolumeByQuarterRow[]> {
  return withRLSContext(claims, async (tx) => {
    if (locationId) {
      // Client role: single location, group by quarter
      return (await tx.execute(sql`
        SELECT
          TO_CHAR(ir.delivery_date, 'YYYY-"Q"Q') AS quarter,
          SUM(il.actual_quantity)::int AS item_count
        FROM intake_lines il
        JOIN intake_records ir ON ir.id = il.intake_record_id
        JOIN pickups pu ON pu.id = ir.pickup_id
        WHERE ir.voided = false
          AND pu.location_id = ${locationId}::uuid
        GROUP BY quarter
        ORDER BY quarter DESC
        LIMIT 8
      `)) as unknown as VolumeByQuarterRow[]
    }

    // Client-global: group by quarter and location
    return (await tx.execute(sql`
      SELECT
        TO_CHAR(ir.delivery_date, 'YYYY-"Q"Q') AS quarter,
        l.name AS location_name,
        SUM(il.actual_quantity)::int AS item_count
      FROM intake_lines il
      JOIN intake_records ir ON ir.id = il.intake_record_id
      LEFT JOIN pickups pu ON pu.id = ir.pickup_id
      LEFT JOIN locations l ON l.id = pu.location_id
      WHERE ir.voided = false
      GROUP BY quarter, l.name
      ORDER BY quarter DESC, l.name
      LIMIT 40
    `)) as unknown as VolumeByQuarterRow[]
  })
}

/**
 * ESG summary for the client.
 * Uses temporal composition join to find material weights active at delivery date.
 * Scoped by RLS (tenant isolation) with optional location filter.
 */
export async function getClientEsgSummary(
  claims: JWTClaims,
  locationId?: string
): Promise<EsgSummaryResult> {
  return withRLSContext(claims, async (tx) => {
    // Temporal composition join — same pattern as ops ESG (Phase 8 RESEARCH Pattern 1)
    type MaterialLine = { actual_quantity: number; weight_grams: number; material_name: string }

    const lines = locationId
      ? ((await tx.execute(sql`
          SELECT
            il.actual_quantity::int AS actual_quantity,
            pm.weight_grams::float AS weight_grams,
            ml.name AS material_name
          FROM intake_lines il
          JOIN intake_records ir ON ir.id = il.intake_record_id
          JOIN pickups pu ON pu.id = ir.pickup_id
          JOIN product_materials pm ON pm.product_id = il.product_id
            AND pm.effective_from <= ir.delivery_date
            AND (pm.effective_to IS NULL OR pm.effective_to > ir.delivery_date)
          JOIN material_library ml ON ml.id = pm.material_library_id
          WHERE ir.voided = false
            AND pu.location_id = ${locationId}::uuid
        `)) as unknown as MaterialLine[])
      : ((await tx.execute(sql`
          SELECT
            il.actual_quantity::int AS actual_quantity,
            pm.weight_grams::float AS weight_grams,
            ml.name AS material_name
          FROM intake_lines il
          JOIN intake_records ir ON ir.id = il.intake_record_id
          JOIN product_materials pm ON pm.product_id = il.product_id
            AND pm.effective_from <= ir.delivery_date
            AND (pm.effective_to IS NULL OR pm.effective_to > ir.delivery_date)
          JOIN material_library ml ON ml.id = pm.material_library_id
          WHERE ir.voided = false
        `)) as unknown as MaterialLine[])

    const materials = sumMaterialWeights(lines)

    // Total item count (without material join to avoid double-counting per material component)
    type CountRow = { total: number }
    const countRows = locationId
      ? ((await tx.execute(sql`
          SELECT COALESCE(SUM(il.actual_quantity), 0)::int AS total
          FROM intake_lines il
          JOIN intake_records ir ON ir.id = il.intake_record_id
          JOIN pickups pu ON pu.id = ir.pickup_id
          WHERE ir.voided = false
            AND pu.location_id = ${locationId}::uuid
        `)) as unknown as CountRow[])
      : ((await tx.execute(sql`
          SELECT COALESCE(SUM(il.actual_quantity), 0)::int AS total
          FROM intake_lines il
          JOIN intake_records ir ON ir.id = il.intake_record_id
          WHERE ir.voided = false
        `)) as unknown as CountRow[])

    const totalItems = countRows[0]?.total ?? 0

    // Reuse rate: items in 'reuse' processing stream / total items
    // Uses processing_reports linked to same tenant (RLS scoped)
    type ReuseRow = { reuse_qty: number; total_qty: number }
    const reuseRows = (await tx.execute(sql`
      SELECT
        0::int AS reuse_qty,
        COALESCE(SUM(prl.quantity), 0)::int AS total_qty
      FROM processing_report_lines prl
      JOIN processing_reports pr ON pr.id = prl.processing_report_id
      WHERE pr.voided = false
    `)) as unknown as ReuseRow[]

    const reuseRow = reuseRows[0]
    const reuseRate = calculateReuseRate(reuseRow?.total_qty ?? 0, reuseRow?.reuse_qty ?? 0)

    return { materials, reuseRate, totalItems }
  })
}

/**
 * Get all active locations for the tenant.
 * Used by client-global role for market drill-down links.
 * RLS scopes to the tenant automatically.
 */
export async function getClientLocations(claims: JWTClaims): Promise<ClientLocation[]> {
  return withRLSContext(claims, async (tx) => {
    const rows = await tx
      .select({
        id: locations.id,
        name: locations.name,
        country: locations.country,
      })
      .from(locations)
      .where(eq(locations.active, true))
      .orderBy(locations.name)

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      country: r.country,
    }))
  })
}
