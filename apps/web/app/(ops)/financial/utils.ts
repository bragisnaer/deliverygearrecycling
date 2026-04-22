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
