'use server'

import { db } from '@repo/db'
import { sql } from 'drizzle-orm'

// --- Types ---

export type PickupStatusRow = {
  status: string
  count: number
}

export type ConsolidationAgeingRow = {
  pickup_id: string
  reference: string
  client_name: string
  pallet_count: number
  arrival_date: string
  days_held: number
}

export type PrisonPipelineRow = {
  facility_name: string
  awaiting: number
  processing: number
  ready: number
  shipped: number
}

export type RevenueSummary = {
  total_invoiced_eur: number
  total_paid_eur: number
  total_uninvoiced_eur: number
  record_count: number
}

export type DashboardTenant = {
  id: string
  name: string
}

// --- Query functions ---

/**
 * Get pickup counts grouped by status, ordered by lifecycle stage.
 * reco-admin cross-tenant query — uses raw db (no RLS context).
 */
export async function getPickupStatusSummary(
  tenantFilter?: string
): Promise<PickupStatusRow[]> {
  const tenantClause = tenantFilter
    ? sql` AND tenant_id = ${tenantFilter}`
    : sql``

  const rows = (await db.execute(sql`
    SELECT status, COUNT(*)::int AS count
    FROM pickups
    WHERE voided = false ${tenantClause}
    GROUP BY status
    ORDER BY CASE status
      WHEN 'submitted' THEN 1
      WHEN 'confirmed' THEN 2
      WHEN 'transport_booked' THEN 3
      WHEN 'picked_up' THEN 4
      WHEN 'at_warehouse' THEN 5
      WHEN 'in_outbound_shipment' THEN 6
      WHEN 'in_transit' THEN 7
      WHEN 'delivered' THEN 8
      WHEN 'intake_registered' THEN 9
      ELSE 10
    END
  `)) as unknown as PickupStatusRow[]

  return rows.map((r) => ({
    status: r.status,
    count: Number(r.count),
  }))
}

/**
 * Get pickups currently at consolidation warehouses with ageing information.
 * Uses updated_at as proxy for arrival_date (set when status transitions to at_warehouse).
 * reco-admin cross-tenant query — uses raw db (no RLS context).
 */
export async function getConsolidationAgeing(
  tenantFilter?: string
): Promise<ConsolidationAgeingRow[]> {
  const tenantClause = tenantFilter
    ? sql` AND p.tenant_id = ${tenantFilter}`
    : sql``

  const rows = (await db.execute(sql`
    SELECT
      p.id AS pickup_id,
      p.reference,
      t.name AS client_name,
      p.pallet_count,
      p.updated_at::text AS arrival_date,
      (EXTRACT(EPOCH FROM NOW() - p.updated_at) / 86400)::int AS days_held
    FROM pickups p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE p.status = 'at_warehouse'
      AND p.voided = false ${tenantClause}
    ORDER BY days_held DESC
  `)) as unknown as ConsolidationAgeingRow[]

  return rows.map((r) => ({
    pickup_id: r.pickup_id,
    reference: r.reference,
    client_name: r.client_name,
    pallet_count: Number(r.pallet_count),
    arrival_date: r.arrival_date,
    days_held: Number(r.days_held),
  }))
}

/**
 * Get prison pipeline summary grouped by facility.
 * Counts intake records at each processing stage: awaiting processing,
 * currently washing, ready to ship (packed), and shipped (dispatched).
 * reco-admin cross-tenant query — uses raw db (no RLS context).
 */
export async function getPrisonPipeline(
  tenantFilter?: string
): Promise<PrisonPipelineRow[]> {
  const tenantClause = tenantFilter
    ? sql` AND ir.tenant_id = ${tenantFilter}`
    : sql``

  const rows = (await db.execute(sql`
    SELECT
      pf.name AS facility_name,
      COUNT(CASE WHEN ir.id IS NOT NULL AND pr.id IS NULL AND od.id IS NULL THEN 1 END)::int AS awaiting,
      COUNT(CASE WHEN pr.id IS NOT NULL AND pr.activity_type = 'wash' AND od.id IS NULL THEN 1 END)::int AS processing,
      COUNT(CASE WHEN pr.id IS NOT NULL AND pr.activity_type = 'pack' AND od.id IS NULL THEN 1 END)::int AS ready,
      COUNT(CASE WHEN od.id IS NOT NULL AND od.voided = false THEN 1 END)::int AS shipped
    FROM prison_facilities pf
    LEFT JOIN intake_records ir ON ir.prison_facility_id = pf.id
      AND ir.voided = false ${tenantClause}
    LEFT JOIN processing_reports pr ON pr.intake_record_id = ir.id
      AND pr.voided = false
    LEFT JOIN outbound_dispatches od ON od.intake_record_id = ir.id
      AND od.voided = false
    WHERE pf.active = true
    GROUP BY pf.id, pf.name
    ORDER BY pf.name
  `)) as unknown as PrisonPipelineRow[]

  return rows.map((r) => ({
    facility_name: r.facility_name,
    awaiting: Number(r.awaiting),
    processing: Number(r.processing),
    ready: Number(r.ready),
    shipped: Number(r.shipped),
  }))
}

/**
 * Get revenue summary totals across all financial records.
 * Sums estimated_invoice_amount_eur grouped by invoice_status.
 * reco-admin cross-tenant query — uses raw db (no RLS context).
 */
export async function getRevenueSummary(
  tenantFilter?: string
): Promise<RevenueSummary> {
  const tenantClause = tenantFilter
    ? sql` WHERE fr.tenant_id = ${tenantFilter}`
    : sql``

  const rows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(fr.estimated_invoice_amount_eur) FILTER (WHERE fr.invoice_status = 'invoiced'), 0) AS total_invoiced_eur,
      COALESCE(SUM(fr.estimated_invoice_amount_eur) FILTER (WHERE fr.invoice_status = 'paid'), 0) AS total_paid_eur,
      COALESCE(SUM(fr.estimated_invoice_amount_eur) FILTER (WHERE fr.invoice_status = 'not_invoiced'), 0) AS total_uninvoiced_eur,
      COUNT(*)::int AS record_count
    FROM financial_records fr ${tenantClause}
  `)) as unknown as {
    total_invoiced_eur: string
    total_paid_eur: string
    total_uninvoiced_eur: string
    record_count: number
  }[]

  const row = rows[0]
  if (!row) {
    return {
      total_invoiced_eur: 0,
      total_paid_eur: 0,
      total_uninvoiced_eur: 0,
      record_count: 0,
    }
  }

  return {
    total_invoiced_eur: Number(row.total_invoiced_eur),
    total_paid_eur: Number(row.total_paid_eur),
    total_uninvoiced_eur: Number(row.total_uninvoiced_eur),
    record_count: Number(row.record_count),
  }
}

/**
 * Get all active tenants for the client context switcher dropdown.
 * reco-admin cross-tenant query — uses raw db (no RLS context).
 */
export async function getDashboardTenants(): Promise<DashboardTenant[]> {
  const rows = (await db.execute(sql`
    SELECT id, name
    FROM tenants
    WHERE active = true
    ORDER BY name
  `)) as unknown as DashboardTenant[]

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
  }))
}
