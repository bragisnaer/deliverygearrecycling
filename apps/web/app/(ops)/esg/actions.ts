'use server'

import { auth } from '@/auth'
import { db } from '@repo/db'
import { sql } from 'drizzle-orm'
import {
  sumMaterialWeights,
  calculateReuseRate,
  calculateCO2Avoided,
} from '@/lib/esg-calculator'
import type { MaterialWeightRow } from '@/lib/esg-calculator'

// --- Auth helper ---

async function requireEsgAccess() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const role = session.user.role
  if (role !== 'reco-admin' && role !== 'reco') throw new Error('Unauthorized: reco role required')
  return session.user
}

// --- Types ---

export type EsgData = {
  materials: MaterialWeightRow[]
  reuseRate: number
  co2: { value_kg: number | null; formula_pending: boolean }
  totalItems: number
}

export type EsgTenant = {
  id: string
  name: string
}

// --- Server Actions ---

/**
 * Get aggregated ESG material weight data via temporal composition join.
 * Excludes voided intake records.
 * Uses raw db (no RLS) — reco-admin cross-tenant query runs as service role.
 */
export async function getEsgData(
  tenantFilter?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<EsgData> {
  await requireEsgAccess()

  type IntakeLine = {
    actual_quantity: number
    weight_grams: number
    material_name: string
  }

  const tenantClause = tenantFilter
    ? sql` AND ir.tenant_id = ${tenantFilter}`
    : sql``

  const dateFromClause = dateFrom
    ? sql` AND ir.delivery_date >= ${dateFrom}::timestamp`
    : sql``

  const dateToClause = dateTo
    ? sql` AND ir.delivery_date <= ${dateTo}::timestamp`
    : sql``

  const rows = (await db.execute(sql`
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
    WHERE ir.voided = false ${tenantClause} ${dateFromClause} ${dateToClause}
  `)) as unknown as IntakeLine[]

  const lines = rows.map((r) => ({
    actual_quantity: Number(r.actual_quantity),
    weight_grams: Number(r.weight_grams),
    material_name: String(r.material_name),
  }))

  const materials = sumMaterialWeights(lines)
  const co2 = calculateCO2Avoided(materials, null)
  const totalItems = lines.reduce((sum, l) => sum + l.actual_quantity, 0)

  return { materials, reuseRate: 0, co2, totalItems }
}

/**
 * Get processing stream counts for reuse rate calculation.
 * Excludes voided processing reports.
 * Uses raw db (no RLS) — reco-admin cross-tenant query.
 */
export async function getProcessingStreamCounts(
  tenantFilter?: string
): Promise<{ reuse_qty: number; total_qty: number }> {
  await requireEsgAccess()

  type StreamRow = {
    reuse_qty: string
    total_qty: string
  }

  const tenantClause = tenantFilter
    ? sql` AND pr.tenant_id = ${tenantFilter}`
    : sql``

  const rows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(prl.quantity) FILTER (WHERE p.processing_stream = 'reuse'), 0)::text AS reuse_qty,
      COALESCE(SUM(prl.quantity), 0)::text AS total_qty
    FROM processing_report_lines prl
    JOIN processing_reports pr ON pr.id = prl.processing_report_id
    JOIN products p ON p.id = pr.product_id
    WHERE pr.voided = false ${tenantClause}
  `)) as unknown as StreamRow[]

  const row = rows[0]
  return {
    reuse_qty: Number(row?.reuse_qty ?? 0),
    total_qty: Number(row?.total_qty ?? 0),
  }
}

/**
 * Get all active tenants for ESG filter dropdown.
 * Uses raw db (no RLS) — tenant list is non-sensitive for reco roles.
 */
export async function getEsgTenants(): Promise<EsgTenant[]> {
  await requireEsgAccess()

  type TenantRow = { id: string; name: string }

  const rows = (await db.execute(sql`
    SELECT id, name
    FROM tenants
    WHERE active = true
    ORDER BY name ASC
  `)) as unknown as TenantRow[]

  return rows.map((r) => ({ id: String(r.id), name: String(r.name) }))
}
