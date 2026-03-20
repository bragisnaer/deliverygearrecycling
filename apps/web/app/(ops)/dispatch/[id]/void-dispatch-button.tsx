'use client'

import { useState } from 'react'
import { VoidRecordDialog } from '@/components/void-record-dialog'
import { voidDispatch } from '../actions'

interface VoidDispatchButtonProps {
  dispatchId: string
  destination: string
}

export function VoidDispatchButton({ dispatchId, destination }: VoidDispatchButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center rounded-md border border-destructive/40 px-4 font-mono text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/5"
      >
        Void
      </button>
      <VoidRecordDialog
        recordType="dispatch"
        recordReference={destination}
        onVoid={(reason) => voidDispatch(dispatchId, reason)}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
