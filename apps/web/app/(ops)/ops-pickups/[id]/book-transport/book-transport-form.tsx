'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { bookDirectTransport, bookConsolidationTransport } from '../../actions'

interface Provider {
  id: string
  name: string
  provider_type: 'direct' | 'consolidation'
}

interface PrisonFacility {
  id: string
  name: string
  address: string
}

interface BookTransportFormProps {
  pickupId: string
  providers: Provider[]
  prisonFacilities: PrisonFacility[]
}

export function BookTransportForm({
  pickupId,
  providers,
  prisonFacilities,
}: BookTransportFormProps) {
  const [transportType, setTransportType] = useState<'direct' | 'consolidation'>('direct')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const filteredProviders = providers.filter(
    (p) => p.provider_type === transportType
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const action =
        transportType === 'direct'
          ? bookDirectTransport
          : bookConsolidationTransport

      const result = await action(formData)

      if ('error' in result) {
        setError(result.error ?? 'An error occurred')
      } else {
        router.push(`/ops-pickups/${pickupId}`)
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="pickup_id" value={pickupId} />

      {/* Transport type selector */}
      <fieldset className="space-y-2">
        <legend className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
          Transport Type
        </legend>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer text-[14px]">
            <input
              type="radio"
              name="transport_type_ui"
              value="direct"
              checked={transportType === 'direct'}
              onChange={() => setTransportType('direct')}
              className="h-4 w-4"
            />
            Direct (market to prison)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-[14px]">
            <input
              type="radio"
              name="transport_type_ui"
              value="consolidation"
              checked={transportType === 'consolidation'}
              onChange={() => setTransportType('consolidation')}
              className="h-4 w-4"
            />
            Consolidation (market to warehouse)
          </label>
        </div>
      </fieldset>

      {/* Provider dropdown */}
      <div className="space-y-1.5">
        <label
          htmlFor="transport_provider_id"
          className="block font-mono text-[12px] text-muted-foreground uppercase tracking-wide"
        >
          Transport Provider
        </label>
        <select
          id="transport_provider_id"
          name="transport_provider_id"
          required
          className="block w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground"
        >
          <option value="">Select a provider</option>
          {filteredProviders.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {filteredProviders.length === 0 && (
          <p className="text-[12px] text-muted-foreground">
            No {transportType} providers available.
          </p>
        )}
      </div>

      {/* Destination prison (direct only) */}
      {transportType === 'direct' && (
        <div className="space-y-1.5">
          <label
            htmlFor="prison_facility_id"
            className="block font-mono text-[12px] text-muted-foreground uppercase tracking-wide"
          >
            Destination Prison
          </label>
          <select
            id="prison_facility_id"
            name="prison_facility_id"
            required
            className="block w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground"
          >
            <option value="">Select a prison facility</option>
            {prisonFacilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} — {f.address}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Transport cost */}
      <div className="space-y-1.5">
        <label
          htmlFor="transport_cost_market_to_destination_eur"
          className="block font-mono text-[12px] text-muted-foreground uppercase tracking-wide"
        >
          {transportType === 'direct'
            ? 'Market to Prison Cost (EUR)'
            : 'Market to Warehouse Cost (EUR)'}
        </label>
        <input
          id="transport_cost_market_to_destination_eur"
          type="number"
          name="transport_cost_market_to_destination_eur"
          required
          min="0"
          step="0.01"
          placeholder="0.00"
          className="block w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground"
        />
      </div>

      {/* Confirmed pickup date */}
      <div className="space-y-1.5">
        <label
          htmlFor="confirmed_pickup_date"
          className="block font-mono text-[12px] text-muted-foreground uppercase tracking-wide"
        >
          Confirmed Pickup Date
        </label>
        <input
          id="confirmed_pickup_date"
          type="date"
          name="confirmed_pickup_date"
          required
          className="block w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-foreground"
        />
      </div>

      {/* Error */}
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-9 items-center rounded-md bg-foreground px-5 font-mono text-[13px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-50"
        >
          {isPending ? 'Booking...' : 'Book Transport'}
        </button>
        <a
          href={`/ops-pickups/${pickupId}`}
          className="inline-flex h-9 items-center rounded-md border border-border bg-background px-5 font-mono text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
        >
          Cancel
        </a>
      </div>
    </form>
  )
}
