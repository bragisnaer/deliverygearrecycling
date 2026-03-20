'use client'

import { useState, useCallback, useRef } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { submitPickupRequest } from '../actions'

// --- Types ---

interface Product {
  id: string
  name: string
  product_code: string
  weight_grams: string | null
}

interface PickupBookingFormProps {
  products: Product[]
  locationId: string
}

// --- Schema ---

const STANDARD_PALLET_WEIGHT_GRAMS = 25000

// Minimum preferred date: 72 hours from now (recalculated at submit time)
const pickupBookingSchema = z.object({
  preferred_date: z.string().min(1, 'Preferred date is required'),
  pallet_count: z
    .number({ invalid_type_error: 'Pallet count is required' })
    .int()
    .min(1, 'At least one pallet is required'),
  pallet_dimensions: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(
    z.object({
      product_id: z.string().uuid(),
      quantity: z.number().int().min(0),
    })
  ),
})

type PickupBookingValues = z.infer<typeof pickupBookingSchema>

// --- Helpers ---

function getMin72hDate(): string {
  const minDate = new Date(Date.now() + 72 * 60 * 60 * 1000)
  return minDate.toISOString().split('T')[0]
}

function formatWeightKg(grams: number): string {
  return (grams / 1000).toFixed(2)
}

// --- Component ---

export function PickupBookingForm({ products, locationId }: PickupBookingFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [photos, setPhotos] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<PickupBookingValues>({
    resolver: zodResolver(pickupBookingSchema),
    defaultValues: {
      preferred_date: '',
      pallet_count: 1,
      pallet_dimensions: '',
      notes: '',
      lines: products.map((p) => ({ product_id: p.id, quantity: 0 })),
    },
  })

  const { fields } = useFieldArray({ control: form.control, name: 'lines' })

  // Watch pallet_count and lines for estimated weight calculation
  const palletCount = form.watch('pallet_count') ?? 1
  const lineValues = form.watch('lines')

  // Auto-calculate estimated weight
  const estimatedWeightGrams = (() => {
    let total = 0
    for (let i = 0; i < lineValues.length; i++) {
      const qty = lineValues[i]?.quantity ?? 0
      const weightGrams = parseFloat(products[i]?.weight_grams ?? '0') || 0
      total += weightGrams * qty
    }
    const count = typeof palletCount === 'number' && palletCount >= 1 ? palletCount : 1
    total += count * STANDARD_PALLET_WEIGHT_GRAMS
    return total
  })()

  // Photo handling
  const addPhotos = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files).filter((f) => f.type.startsWith('image/'))
      setPhotos((prev) => {
        const combined = [...prev, ...incoming]
        if (combined.length > 5) {
          toast.error('Maximum 5 photos allowed')
          return combined.slice(0, 5)
        }
        return combined
      })
    },
    []
  )

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }, [])

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) addPhotos(e.dataTransfer.files)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addPhotos(e.target.files)
    // Reset input so same file can be re-added after removal
    e.target.value = ''
  }

  async function onSubmit(values: PickupBookingValues) {
    // Client-side 72h check (server re-validates)
    const preferredDate = new Date(values.preferred_date)
    const minDate = new Date(Date.now() + 72 * 60 * 60 * 1000)
    if (preferredDate < minDate) {
      toast.error('Preferred date must be at least 72 hours from now')
      return
    }

    const activeLines = values.lines.filter((l) => l.quantity > 0)
    if (activeLines.length === 0) {
      toast.error('At least one product must have a quantity greater than zero')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('preferred_date', new Date(values.preferred_date).toISOString())
      formData.set('pallet_count', String(values.pallet_count))
      if (values.pallet_dimensions) formData.set('pallet_dimensions', values.pallet_dimensions)
      if (values.notes) formData.set('notes', values.notes)

      values.lines.forEach((line, i) => {
        formData.set(`lines[${i}][product_id]`, line.product_id)
        formData.set(`lines[${i}][quantity]`, String(line.quantity))
      })

      // Attach photos (storage upload handled by a separate action in future plan)
      photos.forEach((photo, i) => {
        formData.append(`photos[${i}]`, photo)
      })

      const result = await submitPickupRequest(formData)

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success(`Pickup request submitted — Reference: ${result.reference}`)
        router.push('/pickups')
      }
    } catch {
      toast.error('An unexpected error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {/* Product Quantities Table */}
      <div className="space-y-2">
        <Label className="text-[13px] font-semibold">
          Product Quantities <span className="text-destructive">*</span>
        </Label>
        <p className="text-[12px] text-muted-foreground">
          Enter the quantity for each product being collected.
        </p>
        <div className="overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Product</TableHead>
                <TableHead className="w-[100px] font-mono text-[12px]">Code</TableHead>
                <TableHead className="w-[100px] text-right">Weight (g)</TableHead>
                <TableHead className="w-[120px] text-right">Quantity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, index) => {
                const product = products[index]
                if (!product) return null
                return (
                  <TableRow key={field.id}>
                    <TableCell className="text-[13px] font-medium">{product.name}</TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">
                      {product.product_code}
                    </TableCell>
                    <TableCell className="text-right text-[13px] text-muted-foreground">
                      {product.weight_grams
                        ? Number(product.weight_grams).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-right text-[13px] font-medium transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                        {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
              {fields.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-[13px] text-muted-foreground">
                    No active products found for your account.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Estimated Weight (auto-calculated, read-only) */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
        <div className="flex-1">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Estimated Total Weight
          </p>
          <p className="mt-0.5 text-[22px] font-semibold tabular-nums">
            {formatWeightKg(estimatedWeightGrams)} kg
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Product weight + pallets ({palletCount >= 1 ? palletCount : 1} × 25 kg)
        </p>
      </div>

      {/* Pallet Fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pallet_count" className="text-[13px]">
            Pallet Count <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pallet_count"
            type="number"
            min={1}
            step={1}
            className="h-8 text-[13px]"
            {...form.register('pallet_count', { valueAsNumber: true })}
          />
          {form.formState.errors.pallet_count && (
            <p className="text-[12px] text-destructive">
              {form.formState.errors.pallet_count.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pallet_dimensions" className="text-[13px]">
            Pallet Dimensions
          </Label>
          <Input
            id="pallet_dimensions"
            type="text"
            placeholder="120x80x150cm"
            className="h-8 font-mono text-[13px]"
            {...form.register('pallet_dimensions')}
          />
        </div>
      </div>

      {/* Preferred Pickup Date */}
      <div className="space-y-1.5">
        <Label htmlFor="preferred_date" className="text-[13px]">
          Preferred Pickup Date <span className="text-destructive">*</span>
        </Label>
        <p className="text-[12px] text-muted-foreground">
          Dates within 72 hours are not available.
        </p>
        <Input
          id="preferred_date"
          type="date"
          min={getMin72hDate()}
          className="h-8 w-[200px] text-[13px]"
          {...form.register('preferred_date')}
        />
        {form.formState.errors.preferred_date && (
          <p className="text-[12px] text-destructive">
            {form.formState.errors.preferred_date.message}
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-[13px]">
          Notes
        </Label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Any special instructions for this pickup..."
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-[13px] transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
          {...form.register('notes')}
        />
      </div>

      {/* Photo Upload */}
      <div className="space-y-2">
        <Label className="text-[13px]">
          Photos{' '}
          <span className="font-normal text-muted-foreground">(optional, up to 5)</span>
        </Label>

        {/* Drag-and-drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={[
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragOver
              ? 'border-ring bg-ring/5'
              : 'border-border hover:border-muted-foreground/50 hover:bg-muted/20',
            photos.length >= 5 ? 'pointer-events-none opacity-50' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <svg
            className="h-8 w-8 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <div>
            <p className="text-[13px] font-medium">
              {photos.length >= 5 ? 'Maximum 5 photos reached' : 'Drop photos here or click to browse'}
            </p>
            <p className="text-[12px] text-muted-foreground">PNG, JPG, WEBP up to 5MB each</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Photo preview list */}
        {photos.length > 0 && (
          <ul className="space-y-1.5">
            {photos.map((photo, i) => (
              <li
                key={`${photo.name}-${i}`}
                className="flex items-center justify-between rounded-md border border-border px-3 py-1.5"
              >
                <span className="truncate text-[13px]">{photo.name}</span>
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="ml-2 shrink-0 text-[12px] text-muted-foreground hover:text-destructive"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <p className="text-[12px] text-muted-foreground">
          Fields marked <span className="text-destructive">*</span> are required.
        </p>
        <Button type="submit" disabled={submitting} className="min-w-[160px]">
          {submitting ? 'Submitting...' : 'Submit Pickup Request'}
        </Button>
      </div>
    </form>
  )
}
