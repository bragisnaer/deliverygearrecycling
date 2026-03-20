/**
 * Void helper functions — pure validation utilities for voiding records.
 * No side effects — safe to import on both server and client.
 * Used by voidIntakeRecord, voidProcessingRecord, voidDispatchRecord server actions.
 */

export interface VoidValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate the void reason input before performing any DB writes.
 *
 * Returns { valid: false, error: 'reason_required' } when reason is missing,
 * empty, or whitespace-only.
 * Returns { valid: true } when reason has at least one non-whitespace character.
 */
export function validateVoidInput(
  reason: string | undefined | null
): VoidValidationResult {
  if (!reason || reason.trim().length === 0) {
    return { valid: false, error: 'reason_required' }
  }
  return { valid: true }
}
