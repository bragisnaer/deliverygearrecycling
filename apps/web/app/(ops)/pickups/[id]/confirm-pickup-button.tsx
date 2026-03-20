'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { confirmPickup } from '../actions'

interface ConfirmPickupButtonProps {
  pickupId: string
}

export function ConfirmPickupButton({ pickupId }: ConfirmPickupButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function handleConfirm() {
    setError(null)
    startTransition(async () => {
      const result = await confirmPickup(pickupId)
      if ('error' in result) {
        setError(result.error ?? 'An error occurred')
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="inline-flex h-9 items-center rounded-md bg-foreground px-4 font-mono text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
      >
        {isPending ? 'Confirming...' : 'Confirm Pickup'}
      </button>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
    </div>
  )
}
