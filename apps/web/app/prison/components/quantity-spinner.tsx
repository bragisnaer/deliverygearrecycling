'use client'

import { useTranslations } from 'next-intl'
import { calculateDiscrepancyPct } from '@/lib/discrepancy'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface QuantitySpinnerProps {
  value: number
  onChange: (v: number) => void
  informedQty?: number
  threshold: number
  label: string
}

export function QuantitySpinner({
  value,
  onChange,
  informedQty,
  threshold,
  label,
}: QuantitySpinnerProps) {
  const t = useTranslations('intake.form')

  const discrepancyPct = calculateDiscrepancyPct(value, informedQty)
  const hasDiscrepancy =
    discrepancyPct !== null && discrepancyPct > threshold

  // Compute signed diff for badge
  const diff =
    informedQty !== undefined && informedQty !== null
      ? value - informedQty
      : null

  const handleDecrement = () => {
    onChange(Math.max(0, value - 1))
  }

  const handleIncrement = () => {
    onChange(value + 1)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed)
    }
  }

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseInt(e.target.value, 10)
    if (isNaN(parsed) || parsed < 0) {
      // Reset to current value on invalid input
      e.target.value = String(value)
    } else {
      onChange(parsed)
    }
  }

  return (
    <div
      className={`flex flex-col gap-1 rounded-lg border p-3 transition-colors ${
        hasDiscrepancy
          ? 'border-amber-200 bg-amber-50'
          : 'border-border bg-background'
      }`}
    >
      {/* Label */}
      <span className="text-sm font-medium">{label}</span>

      {/* Spinner controls */}
      <div className="flex items-center gap-3">
        {/* Minus button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= 0}
          aria-label={t('decrease_qty')}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border bg-background text-xl font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40 active:bg-muted"
        >
          −
        </button>

        {/* Quantity display / input */}
        <div className="flex-1">
          <Input
            type="number"
            min={0}
            value={value}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            aria-live="polite"
            aria-label={label}
            className="h-[44px] text-center text-xl font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        {/* Plus button */}
        <button
          type="button"
          onClick={handleIncrement}
          aria-label={t('increase_qty')}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-border bg-background text-xl font-medium transition-colors hover:bg-muted active:bg-muted"
        >
          +
        </button>
      </div>

      {/* Expected quantity note */}
      {informedQty !== undefined && informedQty !== null && (
        <p className="text-sm text-muted-foreground">
          {t('expected')}: {informedQty}
        </p>
      )}

      {/* Discrepancy badge */}
      {hasDiscrepancy && diff !== null && (
        <Badge
          variant="outline"
          role="status"
          className="w-fit border-amber-300 bg-amber-50 text-amber-700"
        >
          {diff > 0 ? `+${diff}` : diff} fra forventet
        </Badge>
      )}
    </div>
  )
}
