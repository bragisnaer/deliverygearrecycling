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
import { getWarehouseInventory, checkAndCreateAgeingAlerts } from './actions'

function getAgeingColour(daysHeld: number, threshold: number): string {
  if (daysHeld >= threshold) {
    return 'text-red-600 font-semibold'
  }
  if (daysHeld >= 7) {
    return 'text-amber-600'
  }
  return 'text-green-600'
}

export default async function WarehouseOutboundPage() {
  await requireAuth(['reco-admin', 'reco', 'transport'])

  const { pickups: heldPickups, threshold } = await getWarehouseInventory()

  // Trigger ageing alert notifications on page load (reco-admin only, non-blocking)
  try {
    await checkAndCreateAgeingAlerts()
  } catch {
    // Non-critical: alert creation failure should not break page render
  }

  return (
    <div className="max-w-7xl space-y-6">
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
  )
}
