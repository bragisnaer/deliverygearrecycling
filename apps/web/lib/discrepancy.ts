/**
 * Calculate discrepancy percentage between actual and informed quantities.
 *
 * Returns null when there is no informed quantity to compare against
 * (informed is undefined, null, or 0 with non-zero actual).
 * Returns 0 when both actual and informed are 0.
 */
export function calculateDiscrepancyPct(
  actual: number,
  informed: number | undefined | null
): number | null {
  if (informed === undefined || informed === null) return null
  if (informed === 0) return actual === 0 ? 0 : null
  return Math.abs((actual - informed) / informed) * 100
}
