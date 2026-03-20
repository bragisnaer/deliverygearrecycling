import { describe, it, expect } from 'vitest'
import { computeFieldDiff, isRecordEdited } from './audit-helpers'

describe('computeFieldDiff', () => {
  it('returns changed fields between old_data and new_data', () => {
    const result = computeFieldDiff({
      old_data: { a: 1, b: 2 },
      new_data: { a: 1, b: 3 },
    })
    expect(result).toEqual([{ field: 'b', old: '2', new: '3' }])
  })

  it('returns empty array when old_data is null (INSERT has no diff)', () => {
    const result = computeFieldDiff({
      old_data: null,
      new_data: { a: 1 },
    })
    expect(result).toEqual([])
  })

  it('ignores updated_at field changes (noise)', () => {
    const result = computeFieldDiff({
      old_data: { name: 'Alice', updated_at: '2024-01-01' },
      new_data: { name: 'Alice', updated_at: '2024-06-01' },
    })
    expect(result).toEqual([])
  })

  it('returns multiple changed fields', () => {
    const result = computeFieldDiff({
      old_data: { name: 'Alice', status: 'active', count: 5 },
      new_data: { name: 'Bob', status: 'inactive', count: 5 },
    })
    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ field: 'name', old: 'Alice', new: 'Bob' })
    expect(result).toContainEqual({ field: 'status', old: 'active', new: 'inactive' })
  })

  it('converts values to strings for display', () => {
    const result = computeFieldDiff({
      old_data: { count: 0 },
      new_data: { count: 42 },
    })
    expect(result).toEqual([{ field: 'count', old: '0', new: '42' }])
  })

  it('returns empty array when no fields changed', () => {
    const result = computeFieldDiff({
      old_data: { name: 'Alice' },
      new_data: { name: 'Alice' },
    })
    expect(result).toEqual([])
  })

  it('returns empty array when new_data is null (DELETE)', () => {
    const result = computeFieldDiff({
      old_data: { name: 'Alice' },
      new_data: null,
    })
    expect(result).toEqual([])
  })
})

describe('isRecordEdited', () => {
  it('returns false for empty entries array', () => {
    expect(isRecordEdited([])).toBe(false)
  })

  it('returns true when any entry has action UPDATE', () => {
    expect(isRecordEdited([{ action: 'UPDATE' }])).toBe(true)
  })

  it('returns false when entries only have INSERT action', () => {
    expect(isRecordEdited([{ action: 'INSERT' }])).toBe(false)
  })

  it('returns false when entries only have DELETE action', () => {
    expect(isRecordEdited([{ action: 'DELETE' }])).toBe(false)
  })

  it('returns true when at least one entry among many is UPDATE', () => {
    expect(
      isRecordEdited([
        { action: 'INSERT' },
        { action: 'UPDATE' },
        { action: 'DELETE' },
      ])
    ).toBe(true)
  })
})
