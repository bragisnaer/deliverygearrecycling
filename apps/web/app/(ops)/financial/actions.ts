'use server'

import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

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

// --- Pure calculation and formatting functions ---

/**
 * Calculate estimated invoice amount = sum of (quantity * price_eur) + transport cost.
 * Handles null pricing by treating as 0.
 * Returns result as a 4-decimal string (consistent with numeric DB columns).
 */
export function calculateInvoiceAmount(
  lines: { actual_quantity: number; price_eur: string | null }[],
  transportCostEur: string | null
): string {
  let total = 0
  for (const line of lines) {
    if (line.price_eur) {
      total += line.actual_quantity * parseFloat(line.price_eur)
    }
  }
  if (transportCostEur) {
    total += parseFloat(transportCostEur)
  }
  return total.toFixed(4)
}

/**
 * Assemble total transport cost from two legs (direct or consolidation route).
 * leg1: market → destination (transport_cost_market_to_destination_eur)
 * leg2: warehouse → prison (allocated_cost_eur) — null for direct deliveries
 * Returns null if both legs are null (unexpected delivery with no transport record).
 */
export function assembleTransportCost(
  leg1: string | null,
  leg2: string | null
): string | null {
  if (!leg1 && !leg2) return null
  const l1 = leg1 ? parseFloat(leg1) : 0
  const l2 = leg2 ? parseFloat(leg2) : 0
  return (l1 + l2).toFixed(4)
}

/**
 * Format a EUR amount for display in the requested currency.
 * Uses the system exchange_rate_eur_dkk for DKK conversion.
 * Returns an em dash for null amounts (no financial record yet).
 */
export function formatCurrency(
  amountEur: string | null,
  currency: 'EUR' | 'DKK',
  exchangeRate: string
): string {
  if (!amountEur) return '\u2014'
  const eur = parseFloat(amountEur)
  if (currency === 'DKK') {
    const dkk = eur * parseFloat(exchangeRate)
    return `${dkk.toFixed(2)} DKK`
  }
  return `\u20AC${eur.toFixed(2)}`
}

// --- Stub Server Actions (to be completed in Plan 02) ---

/**
 * Calculate and store estimated invoice amount for an intake record.
 * Fetches current pricing and transport cost, stores result in financial_records.
 * TODO: Implement in Plan 02
 */
export async function calculateAndStoreInvoiceAmount(
  intakeRecordId: string
): Promise<{ success: true } | { error: string }> {
  void (await requireRecoAdmin())
  void intakeRecordId
  // TODO: Implement in Plan 02
  return { error: 'Not yet implemented' }
}

/**
 * Get all financial records with intake reference and invoice status.
 * Requires reco role with can_view_financials or reco-admin.
 * TODO: Implement in Plan 02
 */
export async function getFinancialRecords(): Promise<unknown[]> {
  void (await requireFinancialAccess())
  // TODO: Implement in Plan 02
  return []
}

/**
 * Update invoice fields (invoice_number, invoice_date, invoice_status, notes).
 * reco-admin only.
 * TODO: Implement in Plan 02
 */
export async function updateInvoiceFields(
  id: string,
  data: {
    invoice_number?: string
    invoice_date?: Date
    invoice_status?: 'not_invoiced' | 'invoiced' | 'paid'
    notes?: string
  }
): Promise<{ success: true } | { error: string }> {
  void (await requireRecoAdmin())
  void id
  void data
  revalidatePath('/financial')
  // TODO: Implement in Plan 02
  return { error: 'Not yet implemented' }
}

/**
 * Get intake records that have been in 'not_invoiced' status beyond threshold days.
 * Used for uninvoiced delivery alerts.
 * TODO: Implement in Plan 02
 */
export async function getUninvoicedAlerts(
  thresholdDays: number
): Promise<unknown[]> {
  void (await requireFinancialAccess())
  void thresholdDays
  // TODO: Implement in Plan 02
  return []
}
