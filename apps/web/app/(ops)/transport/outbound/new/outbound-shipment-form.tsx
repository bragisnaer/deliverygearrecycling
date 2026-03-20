'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createOutboundShipment, calculateProRataAllocation } from '../actions'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type PickupRow = {
  id: string
  reference: string
  location_name: string
  location_country: string
  pallet_count: number
  days_held: number
  lines: Array<{ product_name: string; quantity: number }>
  provider_name: string | null
}

type PrisonFacility = {
  id: string
  name: string
  address: string
}

type TransportProvider = {
  id: string
  name: string
}

type AllocationRow = {
  pickup_id: string
  reference: string
  pallet_count: number
  allocated_cost_eur: string
}

type Props = {
  pickups: PickupRow[]
  prisonFacilities: PrisonFacility[]
  transportProviders: TransportProvider[]
}

const PALLET_SOFT_LIMIT = 7

export function OutboundShipmentForm({ pickups, prisonFacilities, transportProviders }: Props) {
  const router = useRouter()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [prisonFacilityId, setPrisonFacilityId] = useState('')
  const [transportProviderId, setTransportProviderId] = useState('')
  const [totalCost, setTotalCost] = useState('')
  const [allocations, setAllocations] = useState<AllocationRow[]>([])
  const [submitting, setSubmitting] = useState(false)

  const selectedPickups = pickups.filter((p) => selectedIds.has(p.id))
  const totalPallets = selectedPickups.reduce((sum, p) => sum + p.pallet_count, 0)

  const recomputeProRata = useCallback(
    (ids: Set<string>, cost: string) => {
      const selected = pickups.filter((p) => ids.has(p.id))
      if (selected.length === 0 || !cost || isNaN(parseFloat(cost))) {
        setAllocations(
          selected.map((p) => ({
            pickup_id: p.id,
            reference: p.reference,
            pallet_count: p.pallet_count,
            allocated_cost_eur: '0.0000',
          }))
        )
        return
      }
      const proRata = calculateProRataAllocation(
        parseFloat(cost).toFixed(4),
        selected.map((p) => ({ pickupId: p.id, palletCount: p.pallet_count }))
      )
      setAllocations(
        proRata.map((r) => ({
          pickup_id: r.pickupId,
          reference: pickups.find((p) => p.id === r.pickupId)?.reference ?? '',
          pallet_count: r.palletCount,
          allocated_cost_eur: r.allocatedCostEur,
        }))
      )
    },
    [pickups]
  )

  function handleCheckboxChange(pickupId: string, checked: boolean) {
    const next = new Set(selectedIds)
    if (checked) {
      next.add(pickupId)
    } else {
      next.delete(pickupId)
    }
    setSelectedIds(next)
    recomputeProRata(next, totalCost)
  }

  function handleTotalCostChange(value: string) {
    setTotalCost(value)
    recomputeProRata(selectedIds, value)
  }

  function handleAllocationChange(pickupId: string, value: string) {
    setAllocations((prev) =>
      prev.map((a) =>
        a.pickup_id === pickupId ? { ...a, allocated_cost_eur: value } : a
      )
    )
  }

  function handleResetProRata() {
    recomputeProRata(selectedIds, totalCost)
  }

  const allocationSum = allocations.reduce(
    (sum, a) => sum + parseFloat(a.allocated_cost_eur || '0'),
    0
  )
  const totalCostFloat = parseFloat(totalCost || '0')
  const allocationMismatch =
    selectedPickups.length > 0 &&
    totalCost !== '' &&
    Math.abs(allocationSum - totalCostFloat) > 0.01

  const canSubmit =
    selectedPickups.length > 0 &&
    prisonFacilityId !== '' &&
    transportProviderId !== '' &&
    totalCost !== '' &&
    !isNaN(totalCostFloat) &&
    !allocationMismatch &&
    !submitting

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.set('prison_facility_id', prisonFacilityId)
      formData.set('transport_provider_id', transportProviderId)
      formData.set('transport_cost_warehouse_to_prison_eur', parseFloat(totalCost).toFixed(4))
      formData.set(
        'pickup_allocations',
        JSON.stringify(
          allocations.map((a) => ({
            pickup_id: a.pickup_id,
            pallet_count: a.pallet_count,
            allocated_cost_eur: parseFloat(a.allocated_cost_eur).toFixed(4),
          }))
        )
      )

      const result = await createOutboundShipment(formData)

      if ('error' in result) {
        toast.error(result.error)
      } else {
        toast.success('Outbound shipment created successfully')
        router.push('/transport/outbound')
      }
    } catch (err) {
      toast.error('Failed to create outbound shipment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Step 1: Select pickups */}
      <section className="space-y-3">
        <h2 className="text-[15px] font-semibold text-foreground">Select Pickups</h2>
        <p className="text-[13px] text-muted-foreground">
          Choose the held pickups to include in this outbound shipment.
        </p>

        {/* 7-pallet soft warning */}
        {totalPallets > PALLET_SOFT_LIMIT && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-[13px] text-amber-700">
            Soft limit: {PALLET_SOFT_LIMIT} pallets per truck. Currently selected: {totalPallets} pallets.
          </div>
        )}

        {pickups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-[14px] text-muted-foreground">No pickups available at warehouse</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Client / Location</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Pallets</TableHead>
                <TableHead>Days Held</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pickups.map((pickup) => (
                <TableRow key={pickup.id} className={selectedIds.has(pickup.id) ? 'bg-muted/40' : ''}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label={`Select pickup ${pickup.reference}`}
                      checked={selectedIds.has(pickup.id)}
                      onChange={(e) => handleCheckboxChange(pickup.id, e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[13px]">{pickup.reference}</TableCell>
                  <TableCell className="text-[13px]">
                    <div className="font-medium">{pickup.location_name}</div>
                    <div className="text-muted-foreground">{pickup.location_country}</div>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {pickup.lines.length === 0 ? (
                      <span className="italic">—</span>
                    ) : (
                      <ul className="space-y-0.5">
                        {pickup.lines.map((line, i) => (
                          <li key={i}>
                            {line.product_name} &times; {line.quantity}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px]">{pickup.pallet_count}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{pickup.days_held}d</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Step 2: Destination and cost */}
      <section className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="prison_facility_id" className="text-[13px] font-medium text-foreground">
            Destination Prison
          </label>
          <select
            id="prison_facility_id"
            value={prisonFacilityId}
            onChange={(e) => setPrisonFacilityId(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select a prison facility…</option>
            {prisonFacilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="transport_provider_id" className="text-[13px] font-medium text-foreground">
            Transport Provider
          </label>
          <select
            id="transport_provider_id"
            value={transportProviderId}
            onChange={(e) => setTransportProviderId(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Select a transport provider…</option>
            {transportProviders.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="transport_cost_warehouse_to_prison_eur" className="text-[13px] font-medium text-foreground">
            Total Transport Cost (EUR)
          </label>
          <input
            id="transport_cost_warehouse_to_prison_eur"
            type="number"
            min="0"
            step="0.0001"
            value={totalCost}
            onChange={(e) => handleTotalCostChange(e.target.value)}
            placeholder="0.0000"
            required
            className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </section>

      {/* Step 3: Cost allocation breakdown */}
      {allocations.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">Cost Allocation</h2>
            <button
              type="button"
              onClick={handleResetProRata}
              className="text-[12px] text-primary underline hover:no-underline"
            >
              Reset to Pro-rata
            </button>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Costs are allocated pro-rata by pallet count. You can override individual allocations below.
          </p>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Pallets</TableHead>
                <TableHead>Allocated Cost (EUR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.map((a) => (
                <TableRow key={a.pickup_id}>
                  <TableCell className="font-mono text-[13px]">{a.reference}</TableCell>
                  <TableCell className="text-[13px]">{a.pallet_count}</TableCell>
                  <TableCell>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={a.allocated_cost_eur}
                      onChange={(e) => handleAllocationChange(a.pickup_id, e.target.value)}
                      className="w-32 rounded-lg border border-border bg-background px-2 py-1 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {/* Running total row */}
              <TableRow className="border-t-2 font-semibold">
                <TableCell className="text-[13px]">Total</TableCell>
                <TableCell className="text-[13px]">{totalPallets}</TableCell>
                <TableCell>
                  <span
                    className={`text-[13px] font-mono ${allocationMismatch ? 'text-red-600' : 'text-foreground'}`}
                  >
                    {allocationSum.toFixed(4)}
                    {allocationMismatch && (
                      <span className="ml-2 text-[11px]">
                        (must equal {totalCostFloat.toFixed(4)})
                      </span>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>
      )}

      {/* Submit */}
      <div className="flex items-center gap-4 pt-2">
        <Button type="submit" disabled={!canSubmit}>
          {submitting ? 'Creating…' : 'Create Outbound Shipment'}
        </Button>
        {allocationMismatch && (
          <p className="text-[13px] text-red-600">
            Allocation total must equal total transport cost before submitting.
          </p>
        )}
      </div>
    </form>
  )
}
