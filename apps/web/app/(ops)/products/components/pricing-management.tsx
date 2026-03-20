'use client'

import * as React from 'react'
import { Collapsible } from '@base-ui/react/collapsible'
import { ChevronDownIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { createPricingRecord } from '../actions'

interface PricingRecord {
  id: string
  price_eur: string | null
  price_dkk: string | null
  effective_from: Date
  effective_to: Date | null
}

interface PricingManagementProps {
  productId: string
  initialPricing: PricingRecord[]
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

function formatPrice(value: string | null | undefined): string {
  if (!value) return '—'
  const num = Number.parseFloat(value)
  return Number.isNaN(num) ? '—' : num.toFixed(2)
}

export function PricingManagement({ productId, initialPricing }: PricingManagementProps) {
  const [pricing, setPricing] = React.useState(initialPricing)
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const [formState, setFormState] = React.useState({
    price_eur: '',
    price_dkk: '',
    effective_from: '',
  })
  const [formError, setFormError] = React.useState<string | null>(null)

  const currentPricing = pricing.find((p) => p.effective_to === null)
  const historicalPricing = pricing.filter((p) => p.effective_to !== null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!formState.price_eur && !formState.price_dkk) {
      setFormError('At least one of EUR or DKK price is required')
      return
    }
    if (!formState.effective_from) {
      setFormError('Effective date is required')
      return
    }
    if (currentPricing) {
      const newDate = new Date(formState.effective_from)
      const currentDate = new Date(currentPricing.effective_from)
      if (newDate <= currentDate) {
        setFormError('New effective date must be after the current record effective date')
        return
      }
    }

    setSubmitting(true)
    try {
      const result = await createPricingRecord({
        product_id: productId,
        price_eur: formState.price_eur || null,
        price_dkk: formState.price_dkk || null,
        effective_from: formState.effective_from,
      })

      if ('error' in result) {
        setFormError(result.error ?? 'An error occurred')
        return
      }

      toast.success('Pricing record created')
      setShowAddForm(false)
      setFormState({ price_eur: '', price_dkk: '', effective_from: '' })
      // Optimistic update — real data will come on next page load via revalidatePath
    } catch {
      toast.error('Failed to create pricing record')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Current price card */}
      <Card>
        <CardHeader>
          <CardTitle>Current Price</CardTitle>
        </CardHeader>
        <CardContent>
          {currentPricing ? (
            <div className="space-y-1">
              <div className="flex items-baseline gap-3">
                {currentPricing.price_eur && (
                  <span className="text-[20px] font-semibold">
                    €{formatPrice(currentPricing.price_eur)}
                  </span>
                )}
                {currentPricing.price_dkk && (
                  <span className="text-[20px] font-semibold">
                    DKK {formatPrice(currentPricing.price_dkk)}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-muted-foreground">
                Effective from {formatDate(currentPricing.effective_from)}
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground">No pricing set for this product.</p>
              <Button size="sm" onClick={() => setShowAddForm(true)}>
                <PlusIcon className="h-3.5 w-3.5" />
                Set Price
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add new price button */}
      {currentPricing && (
        <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
          <PlusIcon className="h-3.5 w-3.5" />
          Add New Price
        </Button>
      )}

      {/* Price history collapsible */}
      {pricing.length > 0 && (
        <Collapsible.Root>
          <Collapsible.Trigger className="flex items-center gap-1.5 text-[13px] text-primary hover:underline">
            View price history
            <ChevronDownIcon className="h-3.5 w-3.5 transition-transform data-[panel-open]:rotate-180" />
          </Collapsible.Trigger>
          <Collapsible.Panel className="mt-3 overflow-hidden">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">EUR</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">DKK</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Effective From
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Effective To
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pricing.map((record) => (
                    <tr key={record.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        {record.price_eur ? `€${formatPrice(record.price_eur)}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {record.price_dkk ? `DKK ${formatPrice(record.price_dkk)}` : '—'}
                      </td>
                      <td className="px-3 py-2">{formatDate(record.effective_from)}</td>
                      <td className="px-3 py-2">
                        {record.effective_to === null ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-green-600/20">
                            Current
                          </span>
                        ) : (
                          formatDate(record.effective_to)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}

      {/* Add new price dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Price</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[13px] font-medium" htmlFor="price_eur">
                Price EUR (optional)
              </label>
              <Input
                id="price_eur"
                type="text"
                inputMode="decimal"
                placeholder="0.0000"
                value={formState.price_eur}
                onChange={(e) => setFormState((s) => ({ ...s, price_eur: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-medium" htmlFor="price_dkk">
                Price DKK (optional)
              </label>
              <Input
                id="price_dkk"
                type="text"
                inputMode="decimal"
                placeholder="0.0000"
                value={formState.price_dkk}
                onChange={(e) => setFormState((s) => ({ ...s, price_dkk: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-medium" htmlFor="effective_from">
                Effective From
                {currentPricing && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    (must be after {formatDate(currentPricing.effective_from)})
                  </span>
                )}
              </label>
              <Input
                id="effective_from"
                type="date"
                value={formState.effective_from}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, effective_from: e.target.value }))
                }
                min={
                  currentPricing
                    ? (() => {
                        const d = new Date(currentPricing.effective_from)
                        d.setDate(d.getDate() + 1)
                        return d.toISOString().slice(0, 10)
                      })()
                    : undefined
                }
              />
            </div>

            {formError && (
              <p className="text-[13px] text-destructive">{formError}</p>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  setFormError(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save Price'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
