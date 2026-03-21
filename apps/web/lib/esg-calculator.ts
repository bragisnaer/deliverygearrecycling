/**
 * ESG calculation engine — pure functions, no DB dependency.
 * All functions are synchronous and testable without mocking.
 *
 * Used by ESG metrics pages and client dashboard ESG summary widget.
 */

export type MaterialWeightRow = {
  material_name: string
  total_weight_kg: number
  item_count: number
}

/**
 * Aggregate intake line data into per-material weight totals.
 * Handles the case where a single product has multiple material components
 * (one row per material per intake line — see Phase 8 RESEARCH Pitfall 2).
 *
 * @param lines - Rows from the temporal composition join query
 * @returns Sorted list of material weights (heaviest first)
 */
export function sumMaterialWeights(
  lines: { actual_quantity: number; weight_grams: number; material_name: string }[]
): MaterialWeightRow[] {
  const acc = new Map<string, { weight_kg: number; count: number }>()
  for (const line of lines) {
    const kg = (line.actual_quantity * line.weight_grams) / 1000
    const existing = acc.get(line.material_name) ?? { weight_kg: 0, count: 0 }
    acc.set(line.material_name, {
      weight_kg: existing.weight_kg + kg,
      count: existing.count + line.actual_quantity,
    })
  }
  return Array.from(acc.entries())
    .map(([material_name, { weight_kg, count }]) => ({
      material_name,
      total_weight_kg: Math.round(weight_kg * 1000) / 1000,
      item_count: count,
    }))
    .sort((a, b) => b.total_weight_kg - a.total_weight_kg)
}

/**
 * Calculate the reuse rate as a percentage (one decimal place).
 * Returns 0 if no items have been processed.
 *
 * @param totalProcessed - Total items processed across all streams
 * @param reuseProcessed - Items processed in the 'reuse' stream
 * @returns Reuse rate as a percentage, e.g. 72.5
 */
export function calculateReuseRate(totalProcessed: number, reuseProcessed: number): number {
  if (totalProcessed === 0) return 0
  return Math.round((reuseProcessed / totalProcessed) * 1000) / 10
}

/**
 * CO2 avoided calculation — STUB.
 * Formula not yet defined (ESG-04 blocker — see STATE.md).
 * Returns formula_pending: true until formula is agreed with reco/Wolt.
 */
export function calculateCO2Avoided(
  _materialWeights: MaterialWeightRow[],
  _formulaConfig: Record<string, number> | null
): { value_kg: number | null; formula_pending: boolean } {
  return { value_kg: null, formula_pending: true }
}

/**
 * Serialise ESG material weight rows to CSV format.
 * No library needed — data is structured and small.
 *
 * @param rows - Aggregated material weight rows
 * @returns CSV string with header row
 */
export function serializeEsgCsv(rows: MaterialWeightRow[]): string {
  const header = 'Material,Total Weight (kg),Item Count'
  const lines = rows.map(
    (r) => `"${r.material_name.replace(/"/g, '""')}",${r.total_weight_kg},${r.item_count}`
  )
  return [header, ...lines].join('\n')
}
