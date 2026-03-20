'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { IntakeQueueItem } from '../actions'
import { QuarantineOverrideDialog } from './quarantine-override-dialog'

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface IntakeQueueTableProps {
  intakes: IntakeQueueItem[]
}

export function IntakeQueueTable({ intakes }: IntakeQueueTableProps) {
  const [overrideId, setOverrideId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleOverrideClick(id: string) {
    setOverrideId(id)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    setDialogOpen(open)
    if (!open) {
      setOverrideId(null)
    }
  }

  if (intakes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-16 text-center">
        <p className="text-[14px] text-muted-foreground">
          No intake records yet. Expected deliveries appear here once transport is marked delivered.
        </p>
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Facility</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Staff</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Market</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {intakes.map((intake) => {
            const isQuarantineBlocked =
              intake.quarantine_flagged && !intake.quarantine_overridden

            return (
              <TableRow key={intake.id}>
                <TableCell>
                  <span className="font-mono text-[13px] font-medium">
                    {intake.reference || '—'}
                  </span>
                </TableCell>
                <TableCell className="text-[13px]">
                  {intake.facility_name ?? '—'}
                </TableCell>
                <TableCell className="text-[13px]">
                  {intake.client_name ?? '—'}
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {intake.staff_name}
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {formatDate(intake.delivery_date)}
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {intake.origin_market ?? '—'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {intake.is_unexpected && (
                      <Badge variant="outline">Unexpected</Badge>
                    )}
                    {intake.discrepancy_flagged && (
                      <Badge
                        className="bg-amber-50 text-amber-700 border-amber-200"
                        variant="outline"
                      >
                        Discrepancy
                      </Badge>
                    )}
                    {isQuarantineBlocked && (
                      <Badge variant="destructive">Quarantine</Badge>
                    )}
                    {intake.quarantine_overridden && (
                      <Badge variant="secondary">Overridden</Badge>
                    )}
                    {!intake.is_unexpected &&
                      !intake.discrepancy_flagged &&
                      !intake.quarantine_flagged && (
                        <Badge variant="secondary">Clear</Badge>
                      )}
                  </div>
                </TableCell>
                <TableCell>
                  {isQuarantineBlocked && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOverrideClick(intake.id)}
                    >
                      Override
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {overrideId && (
        <QuarantineOverrideDialog
          intakeRecordId={overrideId}
          open={dialogOpen}
          onOpenChange={handleDialogOpenChange}
        />
      )}
    </>
  )
}
