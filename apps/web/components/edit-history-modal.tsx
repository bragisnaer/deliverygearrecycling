'use client'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { computeFieldDiff } from '@/lib/audit-helpers'
import type { AuditEntry } from '@/lib/audit-helpers'

interface EditHistoryModalProps {
  entries: AuditEntry[]
  open: boolean
  onClose: () => void
}

/**
 * Modal showing field-level edit history for a record.
 * Maps each audit_log UPDATE entry through computeFieldDiff and renders a table
 * with Field | Old Value | New Value | Changed By | Changed At columns.
 * Shows an empty state when no edit history exists.
 */
export function EditHistoryModal({
  entries,
  open,
  onClose,
}: EditHistoryModalProps) {
  // Build a flat list of diff rows with context from each entry
  const rows = entries.flatMap((entry) => {
    const diffs = computeFieldDiff(entry)
    return diffs.map((diff) => ({
      field: diff.field,
      old: diff.old,
      new: diff.new,
      changed_by: entry.changed_by ?? '—',
      changed_at: entry.changed_at,
    }))
  })

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Redigeringshistorik</DialogTitle>
        </DialogHeader>

        {rows.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            Ingen redigeringshistorik
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="pb-2 pr-4">Felt</th>
                  <th className="pb-2 pr-4">Gammel værdi</th>
                  <th className="pb-2 pr-4">Ny værdi</th>
                  <th className="pb-2 pr-4">Ændret af</th>
                  <th className="pb-2">Ændret den</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{row.field}</td>
                    <td className="py-2 pr-4 text-destructive line-through">
                      {row.old}
                    </td>
                    <td className="py-2 pr-4 text-green-700">{row.new}</td>
                    <td className="py-2 pr-4">{row.changed_by}</td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(row.changed_at).toLocaleString('da-DK')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
