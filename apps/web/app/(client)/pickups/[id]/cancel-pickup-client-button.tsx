'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelPickupAsClient } from '../actions'

interface CancelPickupClientButtonProps {
  pickupId: string
}

export function CancelPickupClientButton({ pickupId }: CancelPickupClientButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()

  function handleClick() {
    if (!confirmed) {
      setConfirmed(true)
      return
    }

    setError(null)
    startTransition(async () => {
      const result = await cancelPickupAsClient(pickupId)
      if ('error' in result) {
        setError(result.error ?? 'An error occurred')
        setConfirmed(false)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {confirmed ? (
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-muted-foreground">Are you sure?</span>
          <button
            type="button"
            onClick={() => setConfirmed(false)}
            className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 font-mono text-[13px] text-foreground transition-colors hover:bg-muted"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={handleClick}
            disabled={isPending}
            className="inline-flex h-9 items-center rounded-md bg-red-600 px-4 font-mono text-[13px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? 'Cancelling...' : 'Yes, Cancel'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="inline-flex h-9 items-center rounded-md border border-red-300 bg-white px-4 font-mono text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Cancel Pickup
        </button>
      )}
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
