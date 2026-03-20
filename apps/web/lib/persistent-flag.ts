/**
 * Detect markets that persistently exceed the discrepancy threshold.
 *
 * A market is a "persistent problem market" when at least MIN_MONTHS_FLAGGED
 * of the most recent WINDOW_MONTHS months have a discrepancy rate above threshold.
 */
const THRESHOLD_PCT = 15
const MIN_MONTHS_FLAGGED = 3
const WINDOW_MONTHS = 6

export function isPersistentProblemMarket(
  monthlyRates: number[],
  threshold: number = THRESHOLD_PCT,
  minMonths: number = MIN_MONTHS_FLAGGED
): boolean {
  const recent = monthlyRates.slice(0, WINDOW_MONTHS)
  const flaggedCount = recent.filter((rate) => rate > threshold).length
  return flaggedCount >= minMonths
}
