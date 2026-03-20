'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { submitProcessingReport } from '../../actions'

const SIZE_BUCKETS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const

type Client = { id: string; name: string }
type Product = { id: string; name: string; tenant_id: string; product_category: string }

interface ProcessingFormProps {
  clients: Client[]
  products: Product[]
}

export function ProcessingForm({ clients, products }: ProcessingFormProps) {
  const t = useTranslations('processing')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [activityType, setActivityType] = useState<'wash' | 'pack'>('wash')
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const today = new Date().toISOString().split('T')[0]!

  const filteredProducts = selectedTenantId
    ? products.filter((p) => p.tenant_id === selectedTenantId)
    : products

  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const isClothing = selectedProduct?.product_category === 'clothing'

  function handleQuantityChange(bucket: string, value: string) {
    const qty = parseInt(value, 10)
    setQuantities((prev) => ({ ...prev, [bucket]: Number.isNaN(qty) ? 0 : qty }))
  }

  function handleProductChange(productId: string) {
    setSelectedProductId(productId)
    setQuantities({})
  }

  function handleClientChange(tenantId: string) {
    setSelectedTenantId(tenantId)
    setSelectedProductId('')
    setQuantities({})
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const formData = new FormData(formEl)

    // Inject quantities as indexed FormData entries
    if (isClothing) {
      for (const bucket of SIZE_BUCKETS) {
        const qty = quantities[bucket] ?? 0
        formData.set(`lines[${bucket}][quantity]`, String(qty))
      }
    } else {
      const totalQty = quantities['total'] ?? 0
      formData.set('lines[total][quantity]', String(totalQty))
    }

    startTransition(async () => {
      const result = await submitProcessingReport(formData)
      if ('error' in result) {
        const errorKey = result.error as keyof typeof t
        const msg =
          result.error === 'missing_fields'
            ? t('missing_fields')
            : result.error === 'no_lines'
              ? t('no_lines')
              : result.error
        toast.error(msg)
      } else {
        toast.success(t('success'))
        router.push('/prison')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">{t('title')}</h1>

      {/* Activity type toggle */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t('activity_type')}</legend>
        <div className="flex gap-3">
          {(['wash', 'pack'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActivityType(type)}
              className={`min-h-[48px] flex-1 rounded-md border-2 px-6 py-3 font-mono text-base font-medium transition-colors ${
                activityType === type
                  ? 'border-foreground bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-foreground'
              }`}
            >
              {type === 'wash' ? t('wash') : t('pack')}
            </button>
          ))}
        </div>
        <input type="hidden" name="activity_type" value={activityType} />
      </fieldset>

      {/* Staff name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="staff_name" className="text-sm font-medium">
          {t('staff_name')}
        </label>
        <input
          id="staff_name"
          name="staff_name"
          type="text"
          required
          className="min-h-[48px] rounded-md border border-input bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Client selector */}
      <div className="flex flex-col gap-1">
        <label htmlFor="tenant_id" className="text-sm font-medium">
          {t('client')}
        </label>
        <select
          id="tenant_id"
          name="tenant_id"
          required
          value={selectedTenantId}
          onChange={(e) => handleClientChange(e.target.value)}
          className="min-h-[48px] rounded-md border border-input bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">—</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Product selector */}
      <div className="flex flex-col gap-1">
        <label htmlFor="product_id" className="text-sm font-medium">
          {t('product')}
        </label>
        <select
          id="product_id"
          name="product_id"
          required
          value={selectedProductId}
          onChange={(e) => handleProductChange(e.target.value)}
          className="min-h-[48px] rounded-md border border-input bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">—</option>
          {filteredProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Quantity inputs — dynamic based on product_category */}
      {selectedProductId && (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">{t('quantity')}</legend>
          {isClothing ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SIZE_BUCKETS.map((bucket) => (
                <div key={bucket} className="flex flex-col gap-1">
                  <label
                    htmlFor={`qty_${bucket}`}
                    className="text-xs font-mono font-medium text-muted-foreground"
                  >
                    {bucket}
                  </label>
                  <input
                    id={`qty_${bucket}`}
                    type="number"
                    min="0"
                    value={quantities[bucket] ?? ''}
                    onChange={(e) => handleQuantityChange(bucket, e.target.value)}
                    className="min-h-[48px] rounded-md border border-input bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <label htmlFor="qty_total" className="text-sm font-medium">
                {t('total_quantity')}
              </label>
              <input
                id="qty_total"
                type="number"
                min="0"
                value={quantities['total'] ?? ''}
                onChange={(e) => handleQuantityChange('total', e.target.value)}
                className="min-h-[48px] rounded-md border border-input bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
        </fieldset>
      )}

      {/* Date */}
      <div className="flex flex-col gap-1">
        <label htmlFor="report_date" className="text-sm font-medium">
          {t('date')}
        </label>
        <input
          id="report_date"
          name="report_date"
          type="date"
          defaultValue={today}
          required
          className="min-h-[48px] rounded-md border border-input bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1">
        <label htmlFor="notes" className="text-sm font-medium">
          {t('notes')}
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="min-h-[48px] rounded-md border border-input bg-background px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="min-h-[48px] rounded-md border-2 border-foreground bg-primary px-10 py-4 font-mono text-base font-medium text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-50"
      >
        {isPending ? '...' : t('submit')}
      </button>
    </form>
  )
}
