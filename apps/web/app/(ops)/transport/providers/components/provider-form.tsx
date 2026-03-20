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
import { createTransportProvider, updateTransportProvider } from '../actions'

// --- Schema ---

const providerFormSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200),
    contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
    contact_phone: z.string().optional(),
    service_regions: z.string().optional(),
    provider_type: z.enum(['direct', 'consolidation']),
    warehouse_address: z.string().optional(),
    has_platform_access: z.boolean().default(false),
    active: z.boolean().default(true),
    linked_tenant_ids: z.array(z.string()).min(1, 'At least one client must be linked'),
  })
  .refine(
    (data) => {
      if (data.provider_type === 'consolidation') {
        return !!data.warehouse_address && data.warehouse_address.trim().length > 0
      }
      return true
    },
    {
      message: 'Warehouse address is required for consolidation providers',
      path: ['warehouse_address'],
    }
  )

type ProviderFormValues = z.infer<typeof providerFormSchema>

// --- Types ---

interface Tenant {
  id: string
  name: string
}

interface ProviderFormProps {
  tenants: Tenant[]
  provider?: {
    id: string
    name: string
    contact_email: string | null
    contact_phone: string | null
    service_regions: string | null
    provider_type: 'direct' | 'consolidation'
    warehouse_address: string | null
    has_platform_access: boolean
    active: boolean
    linked_tenant_ids: string[]
  }
}

// --- Component ---

export function ProviderForm({ tenants, provider }: ProviderFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const isEdit = Boolean(provider)

  const form = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: {
      name: provider?.name ?? '',
      contact_email: provider?.contact_email ?? '',
      contact_phone: provider?.contact_phone ?? '',
      service_regions: provider?.service_regions ?? '',
      provider_type: provider?.provider_type ?? 'direct',
      warehouse_address: provider?.warehouse_address ?? '',
      has_platform_access: provider?.has_platform_access ?? false,
      active: provider?.active ?? true,
      linked_tenant_ids: provider?.linked_tenant_ids ?? [],
    },
  })

  const providerType = form.watch('provider_type')

  async function onSubmit(values: ProviderFormValues) {
    setSaving(true)
    try {
      const formData = new FormData()
      formData.set('name', values.name)
      formData.set('contact_email', values.contact_email ?? '')
      formData.set('contact_phone', values.contact_phone ?? '')
      formData.set('service_regions', values.service_regions ?? '')
      formData.set('provider_type', values.provider_type)
      formData.set('warehouse_address', values.warehouse_address ?? '')
      formData.set('has_platform_access', String(values.has_platform_access))
      formData.set('active', String(values.active))
      for (const tenantId of values.linked_tenant_ids) {
        formData.append('linked_tenant_ids', tenantId)
      }

      if (isEdit && provider) {
        const result = await updateTransportProvider(provider.id, formData)
        if ('error' in result) {
          toast.error(result.error)
        } else {
          toast.success('Provider saved')
        }
      } else {
        const result = await createTransportProvider(formData)
        if ('error' in result) {
          toast.error(result.error)
        } else {
          toast.success('Provider created')
          router.push(`/transport/providers/${result.providerId}`)
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
                  <Input placeholder="e.g. DHL Freight" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Provider Type */}
          <FormField
            control={form.control}
            name="provider_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Provider Type *</FormLabel>
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
                      <option value="direct">Direct</option>
                      <option value="consolidation">Consolidation</option>
                    </select>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Contact Email */}
          <FormField
            control={form.control}
            name="contact_email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="e.g. ops@dhl.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Contact Phone */}
          <FormField
            control={form.control}
            name="contact_phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Phone</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. +45 12 34 56 78" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Service Regions */}
          <FormField
            control={form.control}
            name="service_regions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Regions</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. DK,SE,FI (comma-separated ISO codes)" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Platform Access */}
          <FormField
            control={form.control}
            name="has_platform_access"
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
                <FormLabel className="!mt-0 cursor-pointer">Platform Access</FormLabel>
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

        {/* Warehouse Address — only shown for consolidation */}
        {providerType === 'consolidation' && (
          <FormField
            control={form.control}
            name="warehouse_address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Warehouse Address *</FormLabel>
                <FormControl>
                  <textarea
                    className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
                    rows={2}
                    placeholder="Full warehouse address for consolidation routing..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Linked Clients — multi-select checkboxes */}
        <FormField
          control={form.control}
          name="linked_tenant_ids"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Linked Clients *</FormLabel>
              <FormControl>
                <div className="space-y-2 rounded-lg border border-input p-3">
                  {tenants.length === 0 ? (
                    <p className="text-[13px] text-muted-foreground">No tenants available.</p>
                  ) : (
                    tenants.map((tenant) => {
                      const checked = field.value.includes(tenant.id)
                      return (
                        <label
                          key={tenant.id}
                          className="flex cursor-pointer items-center gap-2 text-[14px]"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-input accent-primary"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                field.onChange([...field.value, tenant.id])
                              } else {
                                field.onChange(field.value.filter((id) => id !== tenant.id))
                              }
                            }}
                          />
                          {tenant.name}
                          <span className="font-mono text-[12px] text-muted-foreground">
                            ({tenant.id})
                          </span>
                        </label>
                      )
                    })
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Provider'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
