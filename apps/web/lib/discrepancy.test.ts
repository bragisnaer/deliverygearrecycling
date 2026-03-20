import { describe, it, expect } from 'vitest'
import { calculateDiscrepancyPct } from './discrepancy'

describe('calculateDiscrepancyPct', () => {
  it('returns 30 when actual=130 and informed=100 (overage)', () => {
    expect(calculateDiscrepancyPct(130, 100)).toBe(30)
  })

  it('returns 15 when actual=85 and informed=100 (shortage)', () => {
    expect(calculateDiscrepancyPct(85, 100)).toBe(15)
  })

  it('returns 0 when actual equals informed', () => {
    expect(calculateDiscrepancyPct(100, 100)).toBe(0)
  })

  it('returns null when informed is 0 and actual is non-zero (no comparison basis)', () => {
    expect(calculateDiscrepancyPct(50, 0)).toBeNull()
  })

  it('returns 0 when both actual and informed are 0', () => {
    expect(calculateDiscrepancyPct(0, 0)).toBe(0)
  })

  it('returns null when informed is undefined (no informed quantity)', () => {
    expect(calculateDiscrepancyPct(100, undefined)).toBeNull()
  })

  it('returns null when informed is null (no informed quantity)', () => {
    expect(calculateDiscrepancyPct(100, null)).toBeNull()
  })
})

// Wave 0 stub — Server Action integration test (INTAKE-06)
describe('discrepancy detection', () => {
  it.todo('submitIntake flags discrepancy when line exceeds threshold')
})
