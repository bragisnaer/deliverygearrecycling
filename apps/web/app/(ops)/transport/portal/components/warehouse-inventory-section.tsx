import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type InventoryItem = {
  pickup_id: string
  reference: string
  client_name: string
  product_summary: string
  pallet_count: number
  arrival_date: string
  days_held: number
}

type OutboundShipment = {
  id: string
  destination: string
  status: string
  pickup_count: number
  created_at: string
}

function agingClass(daysHeld: number): string {
  if (daysHeld > 14) return 'text-red-600 font-semibold'
  if (daysHeld >= 7) return 'text-amber-600 font-semibold'
  return 'text-green-700'
}

const STATUS_LABEL: Record<string, string> = {
  created: 'Created',
  in_transit: 'In Transit',
  delivered: 'Delivered',
}

export function WarehouseInventorySection({
  inventory,
  shipments,
}: {
  inventory: InventoryItem[]
  shipments: OutboundShipment[]
}) {
  return (
    <div className="space-y-8">
      {/* Warehouse Inventory */}
      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold">Warehouse Inventory</h2>
        {inventory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-[14px] text-muted-foreground">No pickups currently held at warehouse.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Product Summary</TableHead>
                <TableHead>Pallets</TableHead>
                <TableHead>Arrival Date</TableHead>
                <TableHead>Days Held</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.map((item) => (
                <TableRow key={item.pickup_id}>
                  <TableCell className="font-mono text-[13px] font-medium">
                    {item.reference || '—'}
                  </TableCell>
                  <TableCell className="text-[13px]">{item.client_name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground max-w-[200px] truncate">
                    {item.product_summary}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {item.pallet_count}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {item.arrival_date}
                  </TableCell>
                  <TableCell className={`text-[13px] ${agingClass(item.days_held)}`}>
                    {item.days_held}d
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Outbound Shipment History */}
      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold">Outbound Shipment History</h2>
        {shipments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <p className="text-[14px] text-muted-foreground">No outbound shipments in the last 30 days.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shipment ID</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pickups</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((shipment) => (
                <TableRow key={shipment.id}>
                  <TableCell className="font-mono text-[13px] font-medium">
                    OS-{shipment.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-[13px]">{shipment.destination}</TableCell>
                  <TableCell className="text-[13px]">
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium bg-muted text-muted-foreground">
                      {STATUS_LABEL[shipment.status] ?? shipment.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {shipment.pickup_count}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {shipment.created_at}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
