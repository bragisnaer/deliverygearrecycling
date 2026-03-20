'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { overrideQuarantine } from '../actions'

interface QuarantineOverrideDialogProps {
  intakeRecordId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MIN_REASON_LENGTH = 10

export function QuarantineOverrideDialog({
  intakeRecordId,
  open,
  onOpenChange,
}: QuarantineOverrideDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isValid = reason.trim().length >= MIN_REASON_LENGTH

  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      setReason('')
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  function handleConfirm() {
    if (!isValid) return

    setError(null)
    startTransition(async () => {
      const result = await overrideQuarantine(intakeRecordId, reason)

      if ('error' in result) {
        setError(result.error)
        return
      }

      toast.success('Quarantine override approved')
      handleClose(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Quarantine</DialogTitle>
          <DialogDescription>
            This intake record is quarantine-blocked due to a batch flag match. Provide a reason to
            override.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="override-reason"
            className="text-sm font-medium text-foreground"
          >
            Reason
          </label>
          <textarea
            id="override-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for overriding quarantine..."
            rows={4}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50 resize-none"
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground">
            {reason.trim().length}/{MIN_REASON_LENGTH} minimum
          </p>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isPending}
          >
            Approve and Release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
