'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createDispatch } from '../actions'
import type { FacilityOption, TenantOption, ProductOption } from '../actions'

interface DispatchLine {
  product_id: string
  size_bucket: string
  sku_code: string
  quantity: string
}

interface DispatchFormProps {
  facilities: FacilityOption[]
  tenants: TenantOption[]
  products: ProductOption[]
}

const SIZE_BUCKETS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']

function emptyLine(): DispatchLine {
  return { product_id: '', size_bucket: '', sku_code: '', quantity: '1' }
}

export function DispatchForm({ facilities, tenants, products }: DispatchFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [facilityId, setFacilityId] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [dispatchDate, setDispatchDate] = useState('')
  const [destination, setDestination] = useState('')
  const [carrier, setCarrier] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<DispatchLine[]>([emptyLine()])

  function addLine() {
    setLines((prev) => [...prev, emptyLine()])
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index))
  }

  function updateLine(index: number, field: keyof DispatchLine, value: string) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    )
  }

  function getProductCategory(productId: string): string {
    return products.find((p) => p.id === productId)?.product_category ?? 'other'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!facilityId || !tenantId || !dispatchDate || !destination) {
      setError('Please fill in all required fields.')
      return
    }

    const validLines = lines.filter((l) => l.product_id && Number(l.quantity) > 0)
    if (validLines.length === 0) {
      setError('At least one packing list line with a product and quantity is required.')
      return
    }

    setLoading(true)
    try {
      const result = await createDispatch({
        prison_facility_id: facilityId,
        tenant_id: tenantId,
        dispatch_date: new Date(dispatchDate),
        destination,
        carrier: carrier || undefined,
        notes: notes || undefined,
        lines: validLines.map((l) => ({
          product_id: l.product_id,
          size_bucket: l.size_bucket || undefined,
          sku_code: l.sku_code || undefined,
          quantity: Number(l.quantity),
        })),
      })

      if ('error' in result) {
        setError(result.error)
        return
      }

      toast.success('Dispatch created successfully.')
      router.push('/dispatch')
    } catch {
      setError('Failed to create dispatch. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      {/* Core fields */}
      <section className="space-y-4 rounded-xl border border-border p-6">
        <h2 className="font-heading text-[16px] font-semibold">Dispatch Details</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Facility */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="facility_id" className="font-mono text-[13px] font-medium">
              Prison Facility <span className="text-destructive">*</span>
            </label>
            <select
              id="facility_id"
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              required
              disabled={loading}
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select facility…</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tenant/Client */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tenant_id" className="font-mono text-[13px] font-medium">
              Client <span className="text-destructive">*</span>
            </label>
            <select
              id="tenant_id"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              disabled={loading}
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select client…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dispatch date */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="dispatch_date" className="font-mono text-[13px] font-medium">
              Dispatch Date <span className="text-destructive">*</span>
            </label>
            <input
              id="dispatch_date"
              type="date"
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              required
              disabled={loading}
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-[13px] focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Destination */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="destination" className="font-mono text-[13px] font-medium">
              Destination <span className="text-destructive">*</span>
            </label>
            <input
              id="destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. SEKO Logistics, Horsens"
              required
              disabled={loading}
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Carrier */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="carrier" className="font-mono text-[13px] font-medium">
              Carrier
            </label>
            <input
              id="carrier"
              type="text"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g. PostNord"
              disabled={loading}
              className="h-9 rounded-md border border-input bg-background px-3 font-mono text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="notes" className="font-mono text-[13px] font-medium">
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            disabled={loading}
            placeholder="Optional notes…"
            className="resize-none rounded-md border border-input bg-background px-3 py-2 font-mono text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </section>

      {/* Packing list */}
      <section className="space-y-4 rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-[16px] font-semibold">Packing List</h2>
          <button
            type="button"
            onClick={addLine}
            disabled={loading}
            className="inline-flex h-8 items-center rounded-md border border-border bg-background px-3 font-mono text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add Line
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line, index) => {
            const isClothing = getProductCategory(line.product_id) === 'clothing'
            return (
              <div
                key={index}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-end gap-3 rounded-lg border border-border bg-muted/20 p-3"
              >
                {/* Product */}
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Product
                  </label>
                  <select
                    value={line.product_id}
                    onChange={(e) => updateLine(index, 'product_id', e.target.value)}
                    disabled={loading}
                    className="h-8 rounded-md border border-input bg-background px-2 font-mono text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Size bucket (clothing only) */}
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Size
                  </label>
                  <select
                    value={line.size_bucket}
                    onChange={(e) => updateLine(index, 'size_bucket', e.target.value)}
                    disabled={loading || !isClothing}
                    className="h-8 rounded-md border border-input bg-background px-2 font-mono text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">—</option>
                    {SIZE_BUCKETS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SKU code */}
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    SKU Code
                  </label>
                  <input
                    type="text"
                    value={line.sku_code}
                    onChange={(e) => updateLine(index, 'sku_code', e.target.value)}
                    placeholder="SKU-123"
                    disabled={loading}
                    className="h-8 rounded-md border border-input bg-background px-2 font-mono text-[12px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Quantity */}
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Qty
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                    disabled={loading}
                    className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-[12px] focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                {/* Remove line */}
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  disabled={loading || lines.length <= 1}
                  aria-label="Remove line"
                  className="mb-0.5 h-8 w-8 rounded-md border border-border font-mono text-[14px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* Error */}
      {error && (
        <p role="alert" className="text-[14px] text-destructive">
          {error}
        </p>
      )}

      {/* Submit */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-9 items-center rounded-md bg-foreground px-6 font-mono text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Creating…' : 'Create Dispatch'}
        </button>
        <a
          href="/dispatch"
          className="inline-flex h-9 items-center rounded-md border border-border px-4 font-mono text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </a>
      </div>
    </form>
  )
}
