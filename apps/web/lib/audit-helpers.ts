/**
 * Audit helper functions for computing field-level diffs from audit_log entries.
 * These are pure functions with no side effects — safe to use in both server
 * and client contexts.
 */

export interface AuditEntry {
  id: string
  action: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_by: string | null
  changed_at: Date
}

export interface FieldDiff {
  field: string
  old: string
  new: string
}

/**
 * Fields excluded from diff output — these change on every UPDATE and add noise.
 */
const IGNORED_FIELDS = ['updated_at']

/**
 * Compute field-level diffs from an audit log entry's old_data and new_data JSONB.
 *
 * Returns an array of changed fields (excluding noise fields like updated_at).
 * Returns an empty array for INSERT events (old_data is null) and DELETE events
 * (new_data is null), as there is no meaningful before/after to compare.
 */
export function computeFieldDiff(
  entry: Pick<AuditEntry, 'old_data' | 'new_data'>
): FieldDiff[] {
  const { old_data, new_data } = entry

  // INSERT: no old_data to compare against
  if (old_data === null) return []

  // DELETE: no new_data to compare against
  if (new_data === null) return []

  const diffs: FieldDiff[] = []

  for (const field of Object.keys(old_data)) {
    if (IGNORED_FIELDS.includes(field)) continue

    const oldVal = old_data[field]
    const newVal = new_data[field]

    if (String(oldVal) !== String(newVal)) {
      diffs.push({
        field,
        old: String(oldVal),
        new: String(newVal),
      })
    }
  }

  return diffs
}

/**
 * Determine whether a record has ever been edited, based on its audit log entries.
 *
 * Returns true only when at least one entry has action === 'UPDATE'.
 * INSERT and DELETE entries are not considered edits.
 */
export function isRecordEdited(entries: Pick<AuditEntry, 'action'>[]): boolean {
  return entries.some((entry) => entry.action === 'UPDATE')
}
