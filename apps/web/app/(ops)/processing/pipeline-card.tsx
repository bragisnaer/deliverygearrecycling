'use client'

import { useState } from 'react'
import { EditedIndicator } from '@/components/edited-indicator'
import { EditHistoryModal } from '@/components/edit-history-modal'
import { getProcessingReportEditHistory } from './actions'
import type { AuditEntry } from '@/lib/audit-helpers'
import type { ProcessingReportCard } from './actions'

interface PipelineCardProps {
  intakeId: string
  reference: string
  facilityName: string | null
  clientName: string | null
  staffName: string
  deliveryDate: Date
  originMarket: string | null
  washReport: ProcessingReportCard | null
  packReport: ProcessingReportCard | null
}

/**
 * Client component for a single pipeline intake card.
 * Handles EditedIndicator click → fetch audit history → open EditHistoryModal.
 */
export function PipelineCard({
  reference,
  facilityName,
  clientName,
  staffName,
  deliveryDate,
  originMarket,
  washReport,
  packReport,
}: PipelineCardProps) {
  const [historyEntries, setHistoryEntries] = useState<AuditEntry[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)

  async function handleViewHistory(reportId: string) {
    const entries = await getProcessingReportEditHistory(reportId)
    setHistoryEntries(entries as AuditEntry[])
    setHistoryOpen(true)
  }

  return (
    <>
      <div className="rounded-md border border-border bg-card p-3 shadow-sm space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="font-mono text-[12px] font-semibold text-foreground">
            {reference}
          </span>
          {originMarket && (
            <span className="font-mono text-[11px] text-muted-foreground">
              {originMarket}
            </span>
          )}
        </div>

        {clientName && (
          <p className="text-[12px] text-muted-foreground">{clientName}</p>
        )}

        {facilityName && (
          <p className="text-[12px] text-muted-foreground">{facilityName}</p>
        )}

        <p className="text-[12px] text-muted-foreground">
          {new Date(deliveryDate).toLocaleDateString('da-DK')}
        </p>

        <p className="text-[12px] text-muted-foreground">{staffName}</p>

        {/* Processing report indicators — AUDIT-05 */}
        {(washReport || packReport) && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
            {washReport && (
              <div className="flex items-center gap-1">
                <span className="font-mono text-[11px] text-muted-foreground">Vask</span>
                <EditedIndicator
                  isEdited={washReport.isEdited}
                  onViewHistory={() => handleViewHistory(washReport.id)}
                />
              </div>
            )}
            {packReport && (
              <div className="flex items-center gap-1">
                <span className="font-mono text-[11px] text-muted-foreground">Pak</span>
                <EditedIndicator
                  isEdited={packReport.isEdited}
                  onViewHistory={() => handleViewHistory(packReport.id)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <EditHistoryModal
        entries={historyEntries}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </>
  )
}
