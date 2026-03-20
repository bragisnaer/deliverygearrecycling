'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { createProduct, updateProduct } from '../actions'

// --- Schema ---

const productFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  product_code: z.string().min(1, 'Product code is required').max(50),
  product_group: z.string().max(200).optional(),
  processing_stream: z.enum(['recycling', 'reuse']),
  description: z.string().optional(),
  weight_grams: z.string().optional(),
  active: z.boolean().default(true),
})

type ProductFormValues = z.infer<typeof productFormSchema>

// --- Types ---

interface ProductFormProps {
  product?: {
    id: string
    name: string
    product_code: string
    product_group: string | null
    processing_stream: 'recycling' | 'reuse'
    description: string | null
    weight_grams: string | null
    active: boolean
  }
}

// --- Component ---

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(product)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: product?.name ?? '',
      product_code: product?.product_code ?? '',
      product_group: product?.product_group ?? '',
      processing_stream: product?.processing_stream ?? 'recycling',
      description: product?.description ?? '',
      weight_grams: product?.weight_grams ?? '',
      active: product?.active ?? true,
    },
  })

  async function onSubmit(values: ProductFormValues) {
    setSaving(true)
    try {
      const formData = new FormData()
      formData.set('name', values.name)
      formData.set('product_code', values.product_code)
      formData.set('product_group', values.product_group ?? '')
      formData.set('processing_stream', values.processing_stream)
      formData.set('description', values.description ?? '')
      formData.set('weight_grams', values.weight_grams ?? '')
      formData.set('active', String(values.active))

      if (isEdit && product) {
        const result = await updateProduct(product.id, formData)
        if ('error' in result) {
          toast.error(result.error)
        } else {
          toast.success('Product saved')
        }
      } else {
        const result = await createProduct(formData)
        if ('error' in result) {
          toast.error(result.error)
        } else {
          toast.success('Product created')
          router.push(`/products/${result.productId}`)
        }
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Name */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. DHL Bike Bag Large" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Product Code */}
          <FormField
            control={form.control}
            name="product_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Product Code *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. BBL-001" className="font-mono" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Product Group */}
          <FormField
            control={form.control}
            name="product_group"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Group</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Bike Bag" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Processing Stream */}
          <FormField
            control={form.control}
            name="processing_stream"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Processing Stream *</FormLabel>
                <FormControl>
                  <div>
                    <select
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      name={field.name}
                      ref={field.ref}
                    >
                      <option value="recycling">Recycling</option>
                      <option value="reuse">Reuse</option>
                    </select>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Weight */}
          <FormField
            control={form.control}
            name="weight_grams"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (g)</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="e.g. 850" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Active */}
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3 pt-6">
                <FormControl>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    checked={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormLabel className="!mt-0 cursor-pointer">Active</FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <textarea
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                  rows={3}
                  placeholder="Optional description of the product..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
