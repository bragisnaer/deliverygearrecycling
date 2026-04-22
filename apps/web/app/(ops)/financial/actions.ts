'use server'

import { auth } from '@/auth'
import {
  db,
  withRLSContext,
  financialRecords,
  intakeRecords,
  intakeLines,
  tenants,
  transportBookings,
  outboundShipmentPickups,
  productPricing,
  systemSettings,
} from '@repo/db'
import { eq, desc, isNull, and, lt, gte, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { dispatchNotification, getRecoAdminEmails } from '@/lib/notification-events'
import UninvoicedAlertEmail from '@/emails/uninvoiced-alert'

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

async function requireFinancialAccess() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  if (session.user.role === 'reco-admin') return { ...session.user, sub: session.user.id! }
  if (session.user.role === 'reco' && session.user.can_view_financials)
    return { ...session.user, sub: session.user.id! }
  throw new Error('Unauthorized: financial access required')
}

// --- Pure calculation and formatting functions (moved to utils.ts) ---
import { calculateInvoiceAmount, assembleTransportCost } from './utils'

// --- Types ---

export type FinancialRecordListItem = {
  id: string
  intake_record_id: string
  intake_reference: string
  tenant_name: string
  delivery_date: Date
  transport_cost_eur: string | null
  estimated_invoice_amount_eur: string | null
  invoice_status: 'not_invoiced' | 'invoiced' | 'paid'
  invoice_number: string | null
  invoice_date: Date | null
  is_imported: boolean
  created_at: Date
}

export type FinancialRecordDetail = Omit<FinancialRecordListItem, 'is_imported'> & {
  pickup_id: string | null
  tenant_id: string
  notes: string | null
  is_imported: boolean
  updated_at: Date
}

// --- Server Actions ---

/**
 * Get all financial records with intake reference, tenant name, and invoice status.
 * Requires reco role with can_view_financials or reco-admin.
 * Filters out voided intake records.
 */
export async function getFinancialRecords(): Promise<FinancialRecordListItem[]> {
  const user = await requireFinancialAccess()

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: financialRecords.id,
        intake_record_id: financialRecords.intake_record_id,
        intake_reference: intakeRecords.reference,
        tenant_name: tenants.name,
        delivery_date: intakeRecords.delivery_date,
        transport_cost_eur: financialRecords.transport_cost_eur,
        estimated_invoice_amount_eur: financialRecords.estimated_invoice_amount_eur,
        invoice_status: financialRecords.invoice_status,
        invoice_number: financialRecords.invoice_number,
        invoice_date: financialRecords.invoice_date,
        is_imported: financialRecords.is_imported,
        created_at: financialRecords.created_at,
      })
      .from(financialRecords)
      .innerJoin(intakeRecords, eq(intakeRecords.id, financialRecords.intake_record_id))
      .innerJoin(tenants, eq(tenants.id, financialRecords.tenant_id))
      .where(eq(intakeRecords.voided, false))
      .orderBy(desc(financialRecords.created_at))
  })

  return rows.map((r) => ({
    id: r.id,
    intake_record_id: r.intake_record_id,
    intake_reference: r.intake_reference,
    tenant_name: r.tenant_name,
    delivery_date: r.delivery_date,
    transport_cost_eur: r.transport_cost_eur ?? null,
    estimated_invoice_amount_eur: r.estimated_invoice_amount_eur ?? null,
    invoice_status: r.invoice_status,
    invoice_number: r.invoice_number,
    invoice_date: r.invoice_date,
    is_imported: r.is_imported,
    created_at: r.created_at,
  }))
}

/**
 * Get a single financial record by id with intake reference and tenant name.
 * Requires reco role with can_view_financials or reco-admin.
 */
export async function getFinancialRecord(id: string): Promise<FinancialRecordDetail | null> {
  const user = await requireFinancialAccess()

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: financialRecords.id,
        intake_record_id: financialRecords.intake_record_id,
        intake_reference: intakeRecords.reference,
        tenant_name: tenants.name,
        tenant_id: financialRecords.tenant_id,
        delivery_date: intakeRecords.delivery_date,
        pickup_id: intakeRecords.pickup_id,
        transport_cost_eur: financialRecords.transport_cost_eur,
        estimated_invoice_amount_eur: financialRecords.estimated_invoice_amount_eur,
        invoice_status: financialRecords.invoice_status,
        invoice_number: financialRecords.invoice_number,
        invoice_date: financialRecords.invoice_date,
        is_imported: financialRecords.is_imported,
        notes: financialRecords.notes,
        created_at: financialRecords.created_at,
        updated_at: financialRecords.updated_at,
      })
      .from(financialRecords)
      .innerJoin(intakeRecords, eq(intakeRecords.id, financialRecords.intake_record_id))
      .innerJoin(tenants, eq(tenants.id, financialRecords.tenant_id))
      .where(eq(financialRecords.id, id))
      .limit(1)
  })

  const row = rows[0]
  if (!row) return null

  return {
    id: row.id,
    intake_record_id: row.intake_record_id,
    intake_reference: row.intake_reference,
    tenant_name: row.tenant_name,
    tenant_id: row.tenant_id,
    delivery_date: row.delivery_date,
    pickup_id: row.pickup_id ?? null,
    transport_cost_eur: row.transport_cost_eur ?? null,
    estimated_invoice_amount_eur: row.estimated_invoice_amount_eur ?? null,
    invoice_status: row.invoice_status,
    invoice_number: row.invoice_number,
    invoice_date: row.invoice_date,
    is_imported: row.is_imported,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Calculate and store the estimated invoice amount for an intake record.
 * Assembles two-leg transport cost and pricing-based invoice amount.
 * reco-admin only.
 */
export async function calculateAndStoreInvoiceAmount(
  intakeRecordId: string
): Promise<
  | { success: true; transport_cost_eur: string | null; estimated_invoice_amount_eur: string; missing_pricing: string[] }
  | { error: string }
> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    // Step 1: Get intake record
    const intakeRows = await tx
      .select({
        id: intakeRecords.id,
        pickup_id: intakeRecords.pickup_id,
        outbound_shipment_id: intakeRecords.outbound_shipment_id,
      })
      .from(intakeRecords)
      .where(eq(intakeRecords.id, intakeRecordId))
      .limit(1)

    const intakeRecord = intakeRows[0]
    if (!intakeRecord) {
      return { error: 'Intake record not found' }
    }

    // Step 2: Get intake lines
    const lines = await tx
      .select({
        product_id: intakeLines.product_id,
        actual_quantity: intakeLines.actual_quantity,
      })
      .from(intakeLines)
      .where(eq(intakeLines.intake_record_id, intakeRecordId))

    // Step 3: Get current pricing for each product
    const uniqueProductIds = [...new Set(lines.map((l) => l.product_id))]
    const pricingMap = new Map<string, string | null>()
    const missingPricing: string[] = []

    for (const productId of uniqueProductIds) {
      const pricingRows = await tx
        .select({ price_eur: productPricing.price_eur })
        .from(productPricing)
        .where(and(eq(productPricing.product_id, productId), isNull(productPricing.effective_to)))
        .limit(1)

      const pricing = pricingRows[0]
      if (pricing?.price_eur) {
        pricingMap.set(productId, pricing.price_eur)
      } else {
        pricingMap.set(productId, null)
        missingPricing.push(productId)
      }
    }

    // Step 4: Get transport costs (two-leg model)
    let leg1: string | null = null
    let leg2: string | null = null

    if (intakeRecord.pickup_id) {
      // Leg 1: market → destination (transport_cost_market_to_destination_eur)
      const bookingRows = await tx
        .select({ transport_cost_market_to_destination_eur: transportBookings.transport_cost_market_to_destination_eur })
        .from(transportBookings)
        .where(eq(transportBookings.pickup_id, intakeRecord.pickup_id))
        .limit(1)

      leg1 = bookingRows[0]?.transport_cost_market_to_destination_eur ?? null

      // Leg 2: warehouse → prison (allocated_cost_eur)
      const allocationRows = await tx
        .select({ allocated_cost_eur: outboundShipmentPickups.allocated_cost_eur })
        .from(outboundShipmentPickups)
        .where(eq(outboundShipmentPickups.pickup_id, intakeRecord.pickup_id))
        .limit(1)

      leg2 = allocationRows[0]?.allocated_cost_eur ?? null
    }

    // Step 5: Assemble transport cost
    const transportCost = assembleTransportCost(leg1, leg2)

    // Step 6: Build lines array with pricing
    const linesWithPricing = lines.map((l) => ({
      actual_quantity: l.actual_quantity,
      price_eur: pricingMap.get(l.product_id) ?? null,
    }))

    // Step 7: Calculate invoice amount
    const estimatedAmount = calculateInvoiceAmount(linesWithPricing, transportCost)

    // Step 8: Update financial record
    await tx
      .update(financialRecords)
      .set({
        transport_cost_eur: transportCost,
        estimated_invoice_amount_eur: estimatedAmount,
        updated_at: new Date(),
      })
      .where(eq(financialRecords.intake_record_id, intakeRecordId))

    // Step 9: Revalidate
    revalidatePath('/financial')

    return {
      success: true as const,
      transport_cost_eur: transportCost,
      estimated_invoice_amount_eur: estimatedAmount,
      missing_pricing: missingPricing,
    }
  })
}

// Zod schema for invoice field updates
const invoiceFieldsSchema = z.object({
  invoice_status: z.enum(['not_invoiced', 'invoiced', 'paid']),
  invoice_number: z.string().nullable().optional(),
  invoice_date: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

/**
 * Update invoice fields (status, number, date, notes) for a financial record.
 * reco-admin only.
 */
export async function updateInvoiceFields(
  id: string,
  data: {
    invoice_status: string
    invoice_number: string | null
    invoice_date: string | null
    notes: string | null
  }
): Promise<{ success: true } | { error: string }> {
  const user = await requireRecoAdmin()

  const parsed = invoiceFieldsSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }
  }

  const { invoice_status, invoice_number, invoice_date, notes } = parsed.data

  await withRLSContext(user, async (tx) => {
    return tx
      .update(financialRecords)
      .set({
        invoice_status,
        invoice_number: invoice_number ?? null,
        invoice_date: invoice_date ? new Date(invoice_date) : null,
        notes: notes ?? null,
        updated_at: new Date(),
      })
      .where(eq(financialRecords.id, id))
  })

  revalidatePath('/financial')
  return { success: true }
}

/**
 * Set the user's preferred display currency via cookie.
 * Cookie persists for 1 year and triggers Server Component re-render via router.refresh() on client.
 */
export async function setCurrencyPreference(currency: 'EUR' | 'DKK'): Promise<void> {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.set('display_currency', currency, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  })
}

/**
 * Get uninvoiced alert statistics.
 * Counts overdue not_invoiced records and monthly uninvoiced total.
 * Requires reco role with can_view_financials or reco-admin.
 */
export async function getUninvoicedAlerts(
  thresholdDays?: number
): Promise<{ overdue_count: number; overdue_total_eur: string; monthly_uninvoiced_eur: string }> {
  const user = await requireFinancialAccess()

  // Read system settings for threshold (raw db — settings accessible without tenant RLS context)
  let effectiveThreshold = thresholdDays
  if (effectiveThreshold === undefined) {
    const settingsRows = await db
      .select({ warehouse_ageing_threshold_days: systemSettings.warehouse_ageing_threshold_days })
      .from(systemSettings)
      .limit(1)
    effectiveThreshold = settingsRows[0]?.warehouse_ageing_threshold_days ?? 14
  }

  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - effectiveThreshold)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Overdue not_invoiced records (delivered before threshold)
  const overdueRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        count: sql<string>`count(*)`,
        total: sql<string>`coalesce(sum(${financialRecords.estimated_invoice_amount_eur}), 0)`,
      })
      .from(financialRecords)
      .innerJoin(intakeRecords, eq(intakeRecords.id, financialRecords.intake_record_id))
      .where(
        and(
          eq(financialRecords.invoice_status, 'not_invoiced'),
          eq(intakeRecords.voided, false),
          lt(intakeRecords.delivered_at, thresholdDate)
        )
      )
  })

  // Monthly uninvoiced total
  const monthlyRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        total: sql<string>`coalesce(sum(${financialRecords.estimated_invoice_amount_eur}), 0)`,
      })
      .from(financialRecords)
      .where(
        and(
          eq(financialRecords.invoice_status, 'not_invoiced'),
          gte(financialRecords.created_at, startOfMonth)
        )
      )
  })

  const overdueRow = overdueRows[0]
  const monthlyRow = monthlyRows[0]

  return {
    overdue_count: parseInt(overdueRow?.count ?? '0', 10),
    overdue_total_eur: overdueRow?.total ?? '0',
    monthly_uninvoiced_eur: monthlyRow?.total ?? '0',
  }
}

/**
 * Check for uninvoiced deliveries past the threshold and dispatch notification + email.
 * Creates at most one notification per run — deduplication is caller's responsibility
 * (dashboard wires this on page load, which is infrequent enough to avoid spam).
 * reco-admin only.
 */
export async function checkUninvoicedAlerts(): Promise<void> {
  const user = await requireRecoAdmin()

  // Read system settings for threshold (raw db — non-sensitive, no RLS needed)
  const settingsRows = await db
    .select({ warehouse_ageing_threshold_days: systemSettings.warehouse_ageing_threshold_days })
    .from(systemSettings)
    .limit(1)
  const thresholdDays = settingsRows[0]?.warehouse_ageing_threshold_days ?? 14

  const thresholdDate = new Date()
  thresholdDate.setDate(thresholdDate.getDate() - thresholdDays)

  // Query overdue not_invoiced records
  const overdueRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        count: sql<string>`count(*)`,
        total: sql<string>`coalesce(sum(${financialRecords.estimated_invoice_amount_eur}), 0)`,
        oldest_date: sql<Date | null>`min(${intakeRecords.delivery_date})`,
      })
      .from(financialRecords)
      .innerJoin(intakeRecords, eq(intakeRecords.id, financialRecords.intake_record_id))
      .where(
        and(
          eq(financialRecords.invoice_status, 'not_invoiced'),
          eq(intakeRecords.voided, false),
          lt(intakeRecords.delivery_date, thresholdDate)
        )
      )
  })

  const overdueRow = overdueRows[0]
  const uninvoicedCount = parseInt(overdueRow?.count ?? '0', 10)

  if (uninvoicedCount === 0) return

  const oldestDate = overdueRow?.oldest_date ? new Date(overdueRow.oldest_date) : null
  const oldestDays = oldestDate
    ? Math.floor((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24))
    : thresholdDays
  const estimatedRevenue = `\u20AC${parseFloat(overdueRow?.total ?? '0').toFixed(2)}`
  const formattedRevenue = estimatedRevenue

  try {
    const adminEmails = await getRecoAdminEmails()
    await dispatchNotification({
      userId: null,
      tenantId: null,
      type: 'uninvoiced_delivery',
      title: `${uninvoicedCount} deliveries uninvoiced`,
      body: `${uninvoicedCount} deliveries remain uninvoiced. Oldest: ${oldestDays} days.`,
      entityType: 'financial',
      entityId: null,
      email: adminEmails.length > 0 ? {
        to: adminEmails,
        subject: `Uninvoiced Delivery Alert — ${uninvoicedCount} deliveries`,
        react: UninvoicedAlertEmail({
          deliveryCount: uninvoicedCount,
          oldestDays,
          estimatedRevenue: formattedRevenue,
        }),
      } : undefined,
    })
  } catch (err) {
    console.error('[notification] Uninvoiced delivery alert failed:', err)
  }
}
