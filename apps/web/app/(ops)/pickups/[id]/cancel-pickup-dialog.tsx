'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { cancelPickup } from '../actions'

interface CancelPickupDialogProps {
  pickupId: string
}

export function CancelPickupDialog({ pickupId }: CancelPickupDialogProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleCancel() {
    setError(null)
    startTransition(async () => {
      const result = await cancelPickup(pickupId, reason)
      if ('error' in result) {
        setError(result.error)
      } else {
        setOpen(false)
        setReason('')
        router.refresh()
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md border border-red-300 bg-white px-4 font-mono text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        Cancel Pickup
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Pickup</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-[14px] text-muted-foreground">
              Please provide a reason for cancelling this pickup. This action cannot be undone.
            </p>
            <div className="space-y-1">
              <label htmlFor="cancel-reason" className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
                Cancellation Reason
              </label>
              <textarea
                id="cancel-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
              />
            </div>
            {error && <p className="text-[12px] text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 font-mono text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                />
              }
            >
              Keep Pickup
            </DialogClose>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending || !reason.trim()}
              className="inline-flex h-9 items-center rounded-md bg-red-600 px-4 font-mono text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isPending ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
