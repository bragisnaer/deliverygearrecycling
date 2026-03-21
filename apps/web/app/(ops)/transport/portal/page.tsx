import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { getAssignedPickups, getTransportProviderInfo, getWarehouseInventory, getOutboundShipmentHistory } from './actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TransportStats } from './components/transport-stats'
import { WarehouseInventorySection } from './components/warehouse-inventory-section'

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

type PickupRow = {
  booking_id: string
  transport_type: 'direct' | 'consolidation'
  confirmed_pickup_date: Date | null
  delivery_notes: string | null
  proof_of_delivery_path: string | null
  pickup_id: string
  reference: string
  status: string
  pallet_count: number
  preferred_date: Date
  location_name: string
  location_address: string
}

function PickupTable({
  rows,
  emptyMessage,
  dateLabel,
  dateField,
}: {
  rows: PickupRow[]
  emptyMessage: string
  dateLabel: string
  dateField: 'preferred_date' | 'confirmed_pickup_date'
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-[14px] text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Location</TableHead>
          <TableHead>Pallets</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>{dateLabel}</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.booking_id}>
            <TableCell>
              <Link
                href={`/transport/portal/${row.booking_id}`}
                className="font-mono text-[13px] font-medium text-foreground hover:underline"
              >
                {row.reference || '—'}
              </Link>
            </TableCell>
            <TableCell className="text-[13px]">
              <div>{row.location_name}</div>
              <div className="text-muted-foreground">{row.location_address}</div>
            </TableCell>
            <TableCell className="text-[13px] text-muted-foreground">
              {row.pallet_count}
            </TableCell>
            <TableCell>
              <span
                className={[
                  'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium',
                  row.transport_type === 'consolidation'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800',
                ].join(' ')}
              >
                {row.transport_type === 'consolidation' ? 'Consolidation' : 'Direct'}
              </span>
            </TableCell>
            <TableCell className="text-[13px] text-muted-foreground">
              {dateField === 'confirmed_pickup_date'
                ? formatDate(row.confirmed_pickup_date)
                : formatDate(row.preferred_date)}
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/transport/portal/${row.booking_id}`}
                className="font-mono text-[13px] text-primary hover:underline"
              >
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

const TABS = [
  { label: 'Awaiting Collection', value: 'awaiting' },
  { label: 'In Transit', value: 'transit' },
  { label: 'At Warehouse', value: 'warehouse' },
  { label: 'Completed', value: 'completed' },
]

interface TransportPortalPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function TransportPortalPage({ searchParams }: TransportPortalPageProps) {
  await requireAuth(['transport'])
  const { tab } = await searchParams
  const activeTab = tab ?? 'awaiting'

  const { awaiting_collection, at_warehouse, in_transit, completed } = await getAssignedPickups()
  const providerInfo = await getTransportProviderInfo()

  const isConsolidation = providerInfo?.provider_type === 'consolidation'

  const [inventory, shipments] = isConsolidation
    ? await Promise.all([getWarehouseInventory(), getOutboundShipmentHistory()])
    : [[], []]

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">My Pickups</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          View and manage your assigned pickups and shipments.
        </p>
      </div>

      {/* Summary stats */}
      <TransportStats
        counts={{
          awaiting: awaiting_collection.length,
          inTransit: in_transit.length,
          atWarehouse: at_warehouse.length,
          completed: completed.length,
        }}
      />

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((t) => {
          const isActive = activeTab === t.value
          const href = `/transport/portal?tab=${t.value}`
          const count =
            t.value === 'awaiting'
              ? awaiting_collection.length
              : t.value === 'transit'
                ? in_transit.length
                : t.value === 'warehouse'
                  ? at_warehouse.length
                  : completed.length
          return (
            <Link
              key={t.value}
              href={href}
              className={[
                'flex items-center gap-1.5 px-4 py-2 font-mono text-[13px] transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-foreground text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t.label}
              {count > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  {count}
                </span>
              )}
            </Link>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'awaiting' && (
        <PickupTable
          rows={awaiting_collection as PickupRow[]}
          emptyMessage="No pickups awaiting collection."
          dateLabel="Confirmed Date"
          dateField="confirmed_pickup_date"
        />
      )}
      {activeTab === 'transit' && (
        <PickupTable
          rows={in_transit as PickupRow[]}
          emptyMessage="No pickups in transit."
          dateLabel="Pickup Date"
          dateField="confirmed_pickup_date"
        />
      )}
      {activeTab === 'warehouse' && (
        <PickupTable
          rows={at_warehouse as PickupRow[]}
          emptyMessage="No pickups at warehouse."
          dateLabel="Confirmed Date"
          dateField="confirmed_pickup_date"
        />
      )}
      {activeTab === 'completed' && (
        <PickupTable
          rows={completed as PickupRow[]}
          emptyMessage="No completed pickups in the last 30 days."
          dateLabel="Delivery Date"
          dateField="confirmed_pickup_date"
        />
      )}

      {/* Warehouse inventory section — consolidation providers only */}
      {isConsolidation && (
        <WarehouseInventorySection inventory={inventory} shipments={shipments} />
      )}
    </div>
  )
}
