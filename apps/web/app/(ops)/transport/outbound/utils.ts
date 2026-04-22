/**
 * Pure function: distributes totalCost across pickups proportionally by pallet count.
 * Rounding remainder is assigned to the last pickup so allocations sum exactly to totalCost.
 */
export function calculateProRataAllocation(
  totalCost: string,
  pickupAllocations: Array<{ pickupId: string; palletCount: number }>
): Array<{ pickupId: string; palletCount: number; allocatedCostEur: string }> {
  const total = parseFloat(totalCost)
  const totalPallets = pickupAllocations.reduce((sum, p) => sum + p.palletCount, 0)

  if (totalPallets === 0) {
    return pickupAllocations.map((p) => ({
      pickupId: p.pickupId,
      palletCount: p.palletCount,
      allocatedCostEur: (0).toFixed(4),
    }))
  }

  const results = pickupAllocations.map((p) => ({
    pickupId: p.pickupId,
    palletCount: p.palletCount,
    allocatedCostEur: ((p.palletCount / totalPallets) * total).toFixed(4),
  }))

  // Distribute rounding remainder to last item so allocations sum exactly to totalCost
  const sumAllocated = results.reduce((sum, r) => sum + parseFloat(r.allocatedCostEur), 0)
  const remainder = parseFloat((total - sumAllocated).toFixed(4))

  if (remainder !== 0 && results.length > 0) {
    const last = results[results.length - 1]
    last.allocatedCostEur = (parseFloat(last.allocatedCostEur) + remainder).toFixed(4)
  }

  return results
}
