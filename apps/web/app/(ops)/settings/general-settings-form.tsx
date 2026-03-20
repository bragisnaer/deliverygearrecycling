'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { saveGeneralSettings } from './actions'

// --- Schemas ---

const exchangeRateSchema = z.object({
  exchange_rate_eur_dkk: z
    .number({ invalid_type_error: 'Exchange rate must be a number' })
    .min(1, 'Exchange rate must be at least 1')
    .max(999.99, 'Exchange rate must be at most 999.99'),
})

const thresholdSchema = z.object({
  warehouse_ageing_threshold_days: z
    .number({ invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 day')
    .max(365, 'Must be at most 365 days'),
  discrepancy_alert_threshold_pct: z
    .number({ invalid_type_error: 'Must be a number' })
    .int('Must be a whole number')
    .min(1, 'Must be at least 1%')
    .max(100, 'Must be at most 100%'),
})

// --- Types ---

type Settings = {
  exchange_rate_eur_dkk: string | null
  warehouse_ageing_threshold_days: number | null
  discrepancy_alert_threshold_pct: number | null
  updated_at: Date | null
} | null

interface GeneralSettingsFormProps {
  settings: Settings
}

// --- Exchange Rate Card ---

function ExchangeRateCard({ settings }: { settings: Settings }) {
  const [saving, setSaving] = useState(false)

  const form = useForm<z.infer<typeof exchangeRateSchema>>({
    resolver: zodResolver(exchangeRateSchema),
    defaultValues: {
      exchange_rate_eur_dkk: settings?.exchange_rate_eur_dkk
        ? parseFloat(settings.exchange_rate_eur_dkk)
        : 7.46,
    },
  })

  const { formState } = form

  async function onSubmit(values: z.infer<typeof exchangeRateSchema>) {
    setSaving(true)
    try {
      const existing = settings ?? {}
      await saveGeneralSettings({
        exchange_rate_eur_dkk: values.exchange_rate_eur_dkk,
        warehouse_ageing_threshold_days:
          (existing as { warehouse_ageing_threshold_days?: number })
            .warehouse_ageing_threshold_days ?? 14,
        discrepancy_alert_threshold_pct:
          (existing as { discrepancy_alert_threshold_pct?: number })
            .discrepancy_alert_threshold_pct ?? 15,
      })
      form.reset(values)
      toast.success('Settings saved.', { duration: 3000 })
    } catch {
      toast.error('Failed to save. Please try again.', { duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  const updatedAt = settings?.updated_at
    ? new Date(settings.updated_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>EUR/DKK Exchange Rate</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="exchange_rate_eur_dkk"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>EUR/DKK exchange rate</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min={1}
                        max={999.99}
                        className="max-w-[200px]"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? undefined : parseFloat(e.target.value)
                          )
                        }
                      />
                      <span className="text-[14px] text-muted-foreground">DKK per EUR</span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {updatedAt
                      ? `Last updated ${updatedAt}. Applied at display time only — stored values remain in EUR.`
                      : 'Applied at display time only — stored values remain in EUR.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
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
      </CardContent>
    </Card>
  )
}

// --- Alert Thresholds Card ---

function AlertThresholdsCard({ settings }: { settings: Settings }) {
  const [saving, setSaving] = useState(false)

  const form = useForm<z.infer<typeof thresholdSchema>>({
    resolver: zodResolver(thresholdSchema),
    defaultValues: {
      warehouse_ageing_threshold_days:
        settings?.warehouse_ageing_threshold_days ?? 14,
      discrepancy_alert_threshold_pct:
        settings?.discrepancy_alert_threshold_pct ?? 15,
    },
  })

  const { formState } = form

  async function onSubmit(values: z.infer<typeof thresholdSchema>) {
    setSaving(true)
    try {
      await saveGeneralSettings({
        exchange_rate_eur_dkk: settings?.exchange_rate_eur_dkk
          ? parseFloat(settings.exchange_rate_eur_dkk)
          : 7.46,
        warehouse_ageing_threshold_days: values.warehouse_ageing_threshold_days,
        discrepancy_alert_threshold_pct: values.discrepancy_alert_threshold_pct,
      })
      form.reset(values)
      toast.success('Settings saved.', { duration: 3000 })
    } catch {
      toast.error('Failed to save. Please try again.', { duration: 5000 })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert Thresholds</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="warehouse_ageing_threshold_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warehouse ageing threshold</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="1"
                        min={1}
                        max={365}
                        className="max-w-[160px]"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                          )
                        }
                      />
                      <span className="text-[14px] text-muted-foreground">days</span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Pallets held beyond this number of days will trigger an alert.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="discrepancy_alert_threshold_pct"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Discrepancy alert threshold</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="1"
                        min={1}
                        max={100}
                        className="max-w-[160px]"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                          )
                        }
                      />
                      <span className="text-[14px] text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Intake quantities that deviate from informed quantities by more than this
                    percentage will be flagged.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
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
      </CardContent>
    </Card>
  )
}

// --- Main Export ---

export function GeneralSettingsForm({ settings }: GeneralSettingsFormProps) {
  return (
    <div className="space-y-6">
      <ExchangeRateCard settings={settings} />
      <AlertThresholdsCard settings={settings} />
    </div>
  )
}
