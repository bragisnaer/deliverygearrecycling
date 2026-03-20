'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { VoidRecordDialog } from '@/components/void-record-dialog'

interface IntakeVoidButtonProps {
  intakeId: string
  reference: string
  voidAction: (id: string, reason: string) => Promise<{ success?: true; error?: string }>
}

/**
 * Client component that surfaces the void dialog for intake records.
 * Follows the VoidDispatchButton pattern — separated from the Server Component page
 * so the page can stay a pure Server Component while void dialog needs useState.
 */
export function IntakeVoidButton({ intakeId, reference, voidAction }: IntakeVoidButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        Annuller post
      </Button>
      <VoidRecordDialog
        open={open}
        recordType="modtagelse"
        recordReference={reference}
        onVoid={(reason) => voidAction(intakeId, reason)}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
