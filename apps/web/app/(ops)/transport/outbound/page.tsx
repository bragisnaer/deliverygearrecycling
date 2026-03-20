import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  getWarehouseInventory,
  checkAndCreateAgeingAlerts,
  getOutboundShipments,
  markOutboundInTransit,
  markOutboundDelivered,
} from './actions'

const SHIPMENT_STATUS_BADGE: Record<string, string> = {
  created: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
}

function getAgeingColour(daysHeld: number, threshold: number): string {
  if (daysHeld >= threshold) {
    return 'text-red-600 font-semibold'
  }
  if (daysHeld >= 7) {
    return 'text-amber-600'
  }
  return 'text-green-600'
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatCost(eur: string | null | undefined): string {
  if (!eur) return '—'
  return `€${parseFloat(eur).toFixed(2)}`
}

export default async function WarehouseOutboundPage() {
  await requireAuth(['reco-admin', 'reco', 'transport'])

  const [{ pickups: heldPickups, threshold }, { activeShipments, completedShipments }] =
    await Promise.all([getWarehouseInventory(), getOutboundShipments()])

  // Trigger ageing alert notifications on page load (reco-admin only, non-blocking)
  try {
    await checkAndCreateAgeingAlerts()
  } catch {
    // Non-critical: alert creation failure should not break page render
  }

  return (
    <div className="max-w-7xl space-y-10">

      {/* Warehouse Inventory section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
              Warehouse Inventory
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Pickups currently held at consolidation warehouses. Ageing threshold: {threshold} days.
            </p>
          </div>
          <Button render={<Link href="/transport/outbound/new" />}>
            Create Outbound Shipment
          </Button>
        </div>

        {heldPickups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-[14px] text-muted-foreground">
              No pickups currently held at warehouses
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Client / Location</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Pallets</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Arrival Date</TableHead>
                <TableHead>Days Held</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {heldPickups.map((pickup) => (
                <TableRow key={pickup.id}>
                  <TableCell>
                    <Link
                      href={`/pickups/${pickup.id}`}
                      className="font-mono text-[13px] text-primary hover:underline"
                    >
                      {pickup.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[13px]">
                    <div className="font-medium text-foreground">{pickup.location_name}</div>
                    <div className="text-muted-foreground">
                      {pickup.location_country}
                      {pickup.location_address ? ` — ${pickup.location_address}` : ''}
                    </div>
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
                  <TableCell className="text-[13px] text-muted-foreground">
                    {pickup.provider_name ?? '—'}
                    {pickup.provider_warehouse_address ? (
                      <div className="text-[12px]">{pickup.provider_warehouse_address}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {pickup.updated_at.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell className={`text-[13px] ${getAgeingColour(pickup.days_held, threshold)}`}>
                    {pickup.days_held}d
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Active Outbound Shipments section */}
      <div className="space-y-4">
        <h2 className="font-heading text-[18px] font-semibold leading-[1.2]">
          Active Outbound Shipments
        </h2>
        <p className="text-[14px] text-muted-foreground">
          Shipments dispatched to prison facilities awaiting or currently in transit.
        </p>

        {activeShipments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <p className="text-[14px] text-muted-foreground">
              No active outbound shipments
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Destination Prison</TableHead>
                <TableHead>Pallets</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeShipments.map((shipment, index) => (
                <TableRow key={shipment.id}>
                  <TableCell className="font-mono text-[13px] text-muted-foreground">
                    #{String(index + 1).padStart(3, '0')}
                  </TableCell>
                  <TableCell className="text-[13px]">{shipment.provider_name}</TableCell>
                  <TableCell className="text-[13px]">{shipment.prison_name}</TableCell>
                  <TableCell className="text-[13px]">{shipment.total_pallet_count}</TableCell>
                  <TableCell className="font-mono text-[13px]">
                    {formatCost(shipment.transport_cost_warehouse_to_prison_eur)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={[
                        'inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[11px] font-medium capitalize',
                        SHIPMENT_STATUS_BADGE[shipment.status] ?? 'bg-gray-100 text-gray-600',
                      ].join(' ')}
                    >
                      {shipment.status.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {formatDate(shipment.created_at)}
                  </TableCell>
                  <TableCell>
                    {shipment.status === 'created' && (
                      <form
                        action={async () => {
                          'use server'
                          await markOutboundInTransit(shipment.id)
                        }}
                      >
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center rounded-md bg-foreground px-3 font-mono text-[12px] font-medium text-background transition-colors hover:bg-foreground/90"
                        >
                          Mark In Transit
                        </button>
                      </form>
                    )}
                    {shipment.status === 'in_transit' && (
                      <form
                        action={async () => {
                          'use server'
                          await markOutboundDelivered(shipment.id)
                        }}
                      >
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center rounded-md bg-green-600 px-3 font-mono text-[12px] font-medium text-white transition-colors hover:bg-green-700"
                        >
                          Mark Delivered
                        </button>
                      </form>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Completed Shipments section */}
      {completedShipments.length > 0 && (
        <details className="group space-y-4">
          <summary className="cursor-pointer list-none">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-[18px] font-semibold leading-[1.2]">
                Completed Shipments
              </h2>
              <span className="font-mono text-[13px] text-muted-foreground">
                ({completedShipments.length} in the last 30 days)
              </span>
              <span className="ml-auto font-mono text-[12px] text-muted-foreground group-open:hidden">
                Show
              </span>
              <span className="ml-auto hidden font-mono text-[12px] text-muted-foreground group-open:inline">
                Hide
              </span>
            </div>
          </summary>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Destination Prison</TableHead>
                <TableHead>Pallets</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completedShipments.map((shipment, index) => (
                <TableRow key={shipment.id}>
                  <TableCell className="font-mono text-[13px] text-muted-foreground">
                    #{String(index + 1).padStart(3, '0')}
                  </TableCell>
                  <TableCell className="text-[13px]">{shipment.provider_name}</TableCell>
                  <TableCell className="text-[13px]">{shipment.prison_name}</TableCell>
                  <TableCell className="text-[13px]">{shipment.total_pallet_count}</TableCell>
                  <TableCell className="font-mono text-[13px]">
                    {formatCost(shipment.transport_cost_warehouse_to_prison_eur)}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 font-mono text-[11px] font-medium text-green-800">
                      delivered
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {formatDate(shipment.delivered_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      )}
    </div>
  )
}
