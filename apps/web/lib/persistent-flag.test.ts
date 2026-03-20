import { describe, it, expect } from 'vitest'
import { isPersistentProblemMarket } from './persistent-flag'

describe('isPersistentProblemMarket', () => {
  it('returns true when 3 of 6 months exceed threshold (20, 18, 25, 10, 5, 8)', () => {
    expect(isPersistentProblemMarket([20, 18, 25, 10, 5, 8])).toBe(true)
  })

  it('returns false when only 2 of 6 months exceed threshold (20, 18, 10, 10, 5, 8)', () => {
    expect(isPersistentProblemMarket([20, 18, 10, 10, 5, 8])).toBe(false)
  })

  it('returns true when exactly 3 of 6 months exceed threshold (16, 16, 16, 10, 5, 8)', () => {
    expect(isPersistentProblemMarket([16, 16, 16, 10, 5, 8])).toBe(true)
  })

  it('uses only the first 6 months from a longer array', () => {
    // 7 values: first 6 have only 2 above threshold → false
    expect(isPersistentProblemMarket([20, 18, 10, 10, 5, 8, 99])).toBe(false)
  })

  it('returns false when array is empty', () => {
    expect(isPersistentProblemMarket([])).toBe(false)
  })

  it('respects custom threshold parameter', () => {
    // With threshold 10: 20, 18, 25, 10 → 20, 18, 25 exceed (>10), that is 3 → true
    expect(isPersistentProblemMarket([20, 18, 25, 10, 5, 8], 10)).toBe(true)
  })

  it('respects custom minMonths parameter', () => {
    // Only 1 month above default 15% threshold but minMonths=1 → true
    expect(isPersistentProblemMarket([20, 5, 5, 5, 5, 5], 15, 1)).toBe(true)
  })
})
