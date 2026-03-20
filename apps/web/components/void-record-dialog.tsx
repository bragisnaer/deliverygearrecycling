'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface VoidRecordDialogProps {
  /** Human-readable record type — e.g. "intake record", "processing report" */
  recordType: string
  /** Display reference — e.g. "IN-2026-0001" */
  recordReference: string
  /** Server action or async callback; returns { success } or { error } */
  onVoid: (reason: string) => Promise<{ success?: boolean; error?: string }>
  /** Called when the dialog should close (cancelled or after success) */
  onClose: () => void
  open: boolean
}

/**
 * Reusable void-record dialog (AUDIT-04).
 * Collects a mandatory reason, calls onVoid, and surfaces errors inline.
 * Works with intake, processing, and dispatch record server actions.
 */
export function VoidRecordDialog({
  recordType,
  recordReference,
  onVoid,
  onClose,
  open,
}: VoidRecordDialogProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!reason.trim()) {
      setError('reason_required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await onVoid(reason.trim())
      if (result.error) {
        setError(result.error)
      } else {
        // Success — reset and close
        setReason('')
        onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (loading) return
    setReason('')
    setError(null)
    onClose()
  }

  function errorMessage(code: string | null): string | null {
    if (!code) return null
    if (code === 'reason_required') return 'Begrundelse er påkrævet'
    if (code === 'already_voided') return 'Posten er allerede annulleret'
    return 'Der opstod en fejl. Prøv igen.'
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose() }}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
            Annuller post
          </DialogTitle>
          <DialogDescription>
            Du er ved at annullere {recordType}{' '}
            <span className="font-mono font-medium">{recordReference}</span>.
            Posten forbliver i revisionsloggen men ekskluderes fra alle beregninger.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <label htmlFor="void-reason" className="text-sm font-medium">
            Begrundelse
          </label>
          <textarea
            id="void-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error === 'reason_required') setError(null)
            }}
            placeholder="Angiv begrundelse for annullering..."
            rows={3}
            disabled={loading}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(error)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Fortryd
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || !reason.trim()}
          >
            {loading ? 'Annullerer…' : 'Bekræft annullering'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
