import { describe, it, expect } from 'vitest'
import { validateVoidInput } from './void-helpers'

describe('validateVoidInput', () => {
  it('returns error when reason is empty string', () => {
    const result = validateVoidInput('')
    expect(result).toEqual({ valid: false, error: 'reason_required' })
  })

  it('returns error when reason is undefined', () => {
    const result = validateVoidInput(undefined)
    expect(result).toEqual({ valid: false, error: 'reason_required' })
  })

  it('returns error when reason is null', () => {
    const result = validateVoidInput(null)
    expect(result).toEqual({ valid: false, error: 'reason_required' })
  })

  it('returns error when reason is only whitespace', () => {
    const result = validateVoidInput('   ')
    expect(result).toEqual({ valid: false, error: 'reason_required' })
  })

  it('returns valid for a non-empty reason', () => {
    const result = validateVoidInput('quality issue')
    expect(result).toEqual({ valid: true })
  })

  it('returns valid for a single character reason', () => {
    const result = validateVoidInput('x')
    expect(result).toEqual({ valid: true })
  })

  it('returns valid for a reason with leading/trailing whitespace', () => {
    const result = validateVoidInput('  duplicate entry  ')
    expect(result).toEqual({ valid: true })
  })
})
