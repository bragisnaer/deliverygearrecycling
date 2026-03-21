'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateInvoiceFields } from '../actions'

// Zod schema matching server-side validation
const invoiceEditSchema = z.object({
  invoice_status: z.enum(['not_invoiced', 'invoiced', 'paid']),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(),
  notes: z.string().optional(),
})

type InvoiceEditValues = z.infer<typeof invoiceEditSchema>

interface InvoiceEditFormProps {
  id: string
  initialValues: {
    invoice_status: 'not_invoiced' | 'invoiced' | 'paid'
    invoice_number: string | null
    invoice_date: string | null
    notes: string | null
  }
}

const STATUS_OPTIONS: { value: 'not_invoiced' | 'invoiced' | 'paid'; label: string }[] = [
  { value: 'not_invoiced', label: 'Not Invoiced' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'paid', label: 'Paid' },
]

export function InvoiceEditForm({ id, initialValues }: InvoiceEditFormProps) {
  const [saving, setSaving] = useState(false)

  const form = useForm<InvoiceEditValues>({
    resolver: zodResolver(invoiceEditSchema),
    defaultValues: {
      invoice_status: initialValues.invoice_status,
      invoice_number: initialValues.invoice_number ?? '',
      invoice_date: initialValues.invoice_date ?? '',
      notes: initialValues.notes ?? '',
    },
  })

  const { formState } = form

  async function onSubmit(values: InvoiceEditValues) {
    setSaving(true)
    try {
      const result = await updateInvoiceFields(id, {
        invoice_status: values.invoice_status,
        invoice_number: values.invoice_number || null,
        invoice_date: values.invoice_date || null,
        notes: values.notes || null,
      })
      if ('error' in result) {
        toast.error(result.error, { duration: 5000 })
      } else {
        form.reset(values)
        toast.success('Invoice updated.', { duration: 3000 })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save. Please try again.', {
        duration: 5000,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Invoice Status */}
        <FormField
          control={form.control}
          name="invoice_status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice Status</FormLabel>
              <FormControl>
                <select
                  value={field.value}
                  onChange={(e) =>
                    field.onChange(e.target.value as 'not_invoiced' | 'invoiced' | 'paid')
                  }
                  className="flex h-8 w-full max-w-[240px] rounded-lg border border-input bg-transparent px-2.5 py-1 font-mono text-[13px] outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Invoice Number */}
        <FormField
          control={form.control}
          name="invoice_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice Number</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. INV-2026-001"
                  className="max-w-[240px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Invoice Date */}
        <FormField
          control={form.control}
          name="invoice_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  className="max-w-[200px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <textarea
                  rows={3}
                  placeholder="Optional notes..."
                  className="flex w-full max-w-[480px] rounded-lg border border-input bg-transparent px-2.5 py-2 text-[14px] outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={!formState.isDirty || saving}
            className="font-mono text-[13px] font-medium min-h-[44px]"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
