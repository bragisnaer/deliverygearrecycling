'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { QuantitySpinner } from './quantity-spinner'
import { submitIntake, checkBatchFlags } from '../actions'
import { calculateDiscrepancyPct } from '@/lib/discrepancy'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ExpectedDeliveryDetail = {
  pickup_id: string
  reference: string
  client_name: string
  tenant_id: string
  origin_market: string
  lines: {
    product_id: string
    product_name: string
    informed_quantity: number
  }[]
}

interface IntakeFormProps {
  pickup: ExpectedDeliveryDetail
  threshold: number
}

interface LineState {
  product_id: string
  product_name: string
  informed_quantity: number
  actual_quantity: number
  batch_lot_number: string
}

export function IntakeForm({ pickup, threshold }: IntakeFormProps) {
  const t = useTranslations('intake')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]!

  const [staffName, setStaffName] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(today)
  const [originMarket, setOriginMarket] = useState(pickup.origin_market)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineState[]>(
    pickup.lines.map((l) => ({
      product_id: l.product_id,
      product_name: l.product_name,
      informed_quantity: l.informed_quantity,
      actual_quantity: l.informed_quantity, // default to expected quantity
      batch_lot_number: '',
    }))
  )

  // Quarantine state: map from batch_lot_number to flagged reason
  const [quarantineFlags, setQuarantineFlags] = useState<
    { batch_lot_number: string; reason: string }[]
  >([])

  const hasQuarantineBlock = quarantineFlags.length > 0

  // Called on blur of any batch_lot_number input
  const handleBatchBlur = async (value: string) => {
    if (!value.trim()) return
    try {
      const result = await checkBatchFlags([value.trim()])
      if (result.flagged) {
        // Merge new flags with existing ones (deduplicate by batch_lot_number)
        setQuarantineFlags((prev) => {
          const existing = prev.filter(
            (f) => !result.flaggedBatches.some((n) => n.batch_lot_number === f.batch_lot_number)
          )
          return [...existing, ...result.flaggedBatches]
        })
      } else {
        // Remove flag for this batch number if it was previously flagged
        setQuarantineFlags((prev) =>
          prev.filter((f) => f.batch_lot_number !== value.trim())
        )
      }
    } catch {
      // Non-critical — client-side check failure does not block form
    }
  }

  // Check if any line has a discrepancy above threshold
  const hasAnyDiscrepancy = lines.some((line) => {
    const pct = calculateDiscrepancyPct(
      line.actual_quantity,
      line.informed_quantity
    )
    return pct !== null && pct > threshold
  })

  const updateLineQuantity = (index: number, qty: number) => {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, actual_quantity: qty } : line
      )
    )
  }

  const updateLineBatch = (index: number, batch: string) => {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, batch_lot_number: batch } : line
      )
    )
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!staffName.trim()) {
      toast.error(t('errors.submission_failed'))
      return
    }

    const formData = new FormData()
    formData.set('pickup_id', pickup.pickup_id)
    formData.set('staff_name', staffName.trim())
    formData.set('delivery_date', deliveryDate)
    formData.set('origin_market', originMarket)
    formData.set('notes', notes)

    lines.forEach((line, i) => {
      formData.set(`lines[${i}][product_id]`, line.product_id)
      formData.set(
        `lines[${i}][actual_quantity]`,
        String(line.actual_quantity)
      )
      formData.set(
        `lines[${i}][informed_quantity]`,
        String(line.informed_quantity)
      )
      formData.set(`lines[${i}][batch_lot_number]`, line.batch_lot_number)
    })

    startTransition(async () => {
      const result = await submitIntake(formData)
      if ('error' in result) {
        toast.error(t('errors.submission_failed'))
      } else {
        router.push(`/prison/intake/${pickup.pickup_id}/success?intakeId=${result.intakeId}`)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Staff name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="staff_name">{t('form.staff_name')}</Label>
        <Input
          id="staff_name"
          type="text"
          value={staffName}
          onChange={(e) => setStaffName(e.target.value)}
          required
          className="h-[48px]"
        />
      </div>

      {/* Delivery date */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="delivery_date">{t('form.delivery_date')}</Label>
        <Input
          id="delivery_date"
          type="date"
          value={deliveryDate}
          onChange={(e) => setDeliveryDate(e.target.value)}
          required
          className="h-[48px]"
        />
      </div>

      {/* Origin market */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="origin_market">{t('form.origin_market')}</Label>
        <Input
          id="origin_market"
          type="text"
          value={originMarket}
          onChange={(e) => setOriginMarket(e.target.value)}
          className="h-[48px]"
        />
      </div>

      {/* Product lines */}
      <div className="flex flex-col gap-4">
        {lines.map((line, i) => (
          <div key={line.product_id} className="flex flex-col gap-2">
            <QuantitySpinner
              label={line.product_name}
              value={line.actual_quantity}
              onChange={(v) => updateLineQuantity(i, v)}
              informedQty={line.informed_quantity}
              threshold={threshold}
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor={`batch_${i}`} className="text-sm text-muted-foreground">
                {t('form.batch_lot_number')} ({line.product_name})
              </Label>
              <Input
                id={`batch_${i}`}
                type="text"
                value={line.batch_lot_number}
                onChange={(e) => updateLineBatch(i, e.target.value)}
                onBlur={(e) => handleBatchBlur(e.target.value)}
                className="h-[44px]"
                placeholder="Valgfrit"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">{t('form.notes')}</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Valgfrit"
        />
      </div>

      {/* Discrepancy summary banner */}
      {hasAnyDiscrepancy && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {t('discrepancy.summary')}
        </div>
      )}

      {/* Quarantine block banner */}
      {hasQuarantineBlock && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            <p className="font-semibold mb-1">{t('quarantine.blocked')}</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {quarantineFlags.map((f) => (
                <li key={f.batch_lot_number}>
                  <span className="font-mono">{f.batch_lot_number}</span>:{' '}
                  {f.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Submit */}
      <Button
        type="submit"
        disabled={isPending || hasQuarantineBlock}
        className="min-h-[48px] w-full bg-primary font-mono text-base text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {isPending
          ? '…'
          : hasQuarantineBlock
            ? 'Karantæne — afventer godkendelse'
            : t('form.submit')}
      </Button>
    </form>
  )
}
