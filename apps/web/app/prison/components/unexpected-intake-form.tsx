'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { QuantitySpinner } from './quantity-spinner'
import { getProductsForClient, submitUnexpectedIntake } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Client {
  id: string
  name: string
}

interface Product {
  id: string
  name: string
  weight_grams: number | null
}

interface LineState {
  product_id: string
  product_name: string
  actual_quantity: number
  batch_lot_number: string
}

interface UnexpectedIntakeFormProps {
  clients: Client[]
  threshold: number
}

export function UnexpectedIntakeForm({
  clients,
  threshold,
}: UnexpectedIntakeFormProps) {
  const t = useTranslations('intake')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const today = new Date().toISOString().split('T')[0]!

  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productsError, setProductsError] = useState(false)

  const [staffName, setStaffName] = useState('')
  const [deliveryDate, setDeliveryDate] = useState(today)
  const [originMarket, setOriginMarket] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineState[]>([])

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    setLines([])
    setProducts([])
    setProductsError(false)

    if (!clientId) return

    setProductsLoading(true)
    startTransition(async () => {
      try {
        const fetched = await getProductsForClient(clientId)
        setProducts(fetched)
        setLines(
          fetched.map((p) => ({
            product_id: p.id,
            product_name: p.name,
            actual_quantity: 0,
            batch_lot_number: '',
          }))
        )
      } catch {
        setProductsError(true)
        toast.error(t('errors.client_load_failed'))
      } finally {
        setProductsLoading(false)
      }
    })
  }

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

    if (!selectedClientId) {
      toast.error(t('errors.submission_failed'))
      return
    }

    if (!staffName.trim()) {
      toast.error(t('errors.submission_failed'))
      return
    }

    const formData = new FormData()
    formData.set('tenant_id', selectedClientId)
    formData.set('staff_name', staffName.trim())
    formData.set('delivery_date', deliveryDate)
    formData.set('origin_market', originMarket)
    formData.set('notes', notes)

    lines.forEach((line, i) => {
      formData.set(`lines[${i}][product_id]`, line.product_id)
      formData.set(`lines[${i}][actual_quantity]`, String(line.actual_quantity))
      formData.set(`lines[${i}][batch_lot_number]`, line.batch_lot_number)
    })

    startTransition(async () => {
      const result = await submitUnexpectedIntake(formData)
      if ('error' in result) {
        toast.error(t('errors.submission_failed'))
      } else {
        // Use intakeId as the route [id] segment — no pickup_id on unexpected deliveries
        router.push(
          `/prison/intake/${result.intakeId}/success?intakeId=${result.intakeId}`
        )
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Client selection */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="client_select">{t('form.client')}</Label>
        <Select value={selectedClientId} onValueChange={handleClientChange}>
          <SelectTrigger
            id="client_select"
            className="h-[48px] w-full"
            size="default"
          >
            <SelectValue placeholder={t('form.select_client')} />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      {/* Product lines — rendered after client selection */}
      {selectedClientId && (
        <div className="flex flex-col gap-4">
          {productsLoading && (
            <div className="flex flex-col gap-3" aria-busy="true">
              {/* Skeleton loader */}
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-[72px] animate-pulse rounded-lg border border-border bg-muted"
                />
              ))}
            </div>
          )}

          {productsError && !productsLoading && (
            <p className="text-sm text-destructive">
              {t('errors.client_load_failed')}
            </p>
          )}

          {!productsLoading && !productsError && products.length === 0 && selectedClientId && (
            <p className="text-sm text-muted-foreground">
              Ingen aktive produkter fundet for denne klient.
            </p>
          )}

          {!productsLoading &&
            !productsError &&
            lines.map((line, i) => (
              <div key={line.product_id} className="flex flex-col gap-2">
                <QuantitySpinner
                  label={line.product_name}
                  value={line.actual_quantity}
                  onChange={(v) => updateLineQuantity(i, v)}
                  threshold={threshold}
                />
                <div className="flex flex-col gap-1">
                  <Label
                    htmlFor={`batch_${i}`}
                    className="text-sm text-muted-foreground"
                  >
                    {t('form.batch_lot_number')} ({line.product_name})
                  </Label>
                  <Input
                    id={`batch_${i}`}
                    type="text"
                    value={line.batch_lot_number}
                    onChange={(e) => updateLineBatch(i, e.target.value)}
                    className="h-[44px]"
                    placeholder="Valgfrit"
                  />
                </div>
              </div>
            ))}
        </div>
      )}

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

      {/* Submit */}
      <Button
        type="submit"
        disabled={isPending || !selectedClientId || lines.length === 0}
        className="min-h-[48px] w-full bg-primary font-mono text-base text-primary-foreground hover:bg-primary/90"
      >
        {isPending ? '…' : t('form.submit')}
      </Button>
    </form>
  )
}
