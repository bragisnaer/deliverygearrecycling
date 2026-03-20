import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { getPickupQueue } from './actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const STATUS_TABS = [
  { label: 'All', value: undefined },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Transport Booked', value: 'transport_booked' },
  { label: 'In Transit', value: 'in_transit' },
  { label: 'Delivered', value: 'delivered' },
]

const STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  transport_booked: 'bg-purple-100 text-purple-800',
  picked_up: 'bg-indigo-100 text-indigo-800',
  at_warehouse: 'bg-cyan-100 text-cyan-800',
  in_outbound_shipment: 'bg-teal-100 text-teal-800',
  in_transit: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  intake_registered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600',
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface PickupsPageProps {
  searchParams: Promise<{ status?: string }>
}

export default async function OpsPickupsPage({ searchParams }: PickupsPageProps) {
  await requireAuth(['reco-admin', 'reco'])
  const { status } = await searchParams

  const pickupList = await getPickupQueue(status)

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">Pickup Queue</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Manage and track all pickup requests.
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {STATUS_TABS.map((tab) => {
          const isActive = tab.value === status || (tab.value === undefined && !status)
          const href = tab.value ? `/pickups?status=${tab.value}` : '/pickups'
          return (
            <Link
              key={tab.label}
              href={href}
              className={[
                'px-4 py-2 font-mono text-[13px] transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-foreground text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>

      {pickupList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[14px] text-muted-foreground">No pickups found for this filter.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pallets</TableHead>
              <TableHead>Preferred Date</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pickupList.map((pickup) => (
              <TableRow key={pickup.id}>
                <TableCell>
                  <Link
                    href={`/pickups/${pickup.id}`}
                    className="font-mono text-[13px] font-medium text-foreground hover:underline"
                  >
                    {pickup.reference || '—'}
                  </Link>
                </TableCell>
                <TableCell className="text-[13px]">
                  <div>{pickup.location_name ?? '—'}</div>
                  {pickup.location_address && (
                    <div className="text-muted-foreground">{pickup.location_address}</div>
                  )}
                </TableCell>
                <TableCell>
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium capitalize',
                      STATUS_BADGE[pickup.status] ?? 'bg-gray-100 text-gray-600',
                    ].join(' ')}
                  >
                    {pickup.status.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {pickup.pallet_count}
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {formatDate(pickup.preferred_date)}
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {formatDate(pickup.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
