import Link from 'next/link'

type ActivePickup = { status: string; count: number }
type RecentPickup = { id: string; reference: string; status: string; created_at: string }

function StatusBadge({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    submitted: 'Submitted',
    confirmed: 'Confirmed',
    transport_booked: 'Transport Booked',
    picked_up: 'Picked Up',
    at_warehouse: 'At Warehouse',
    in_outbound_shipment: 'In Shipment',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    intake_registered: 'Registered',
    cancelled: 'Cancelled',
  }

  const colorMap: Record<string, string> = {
    submitted: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    confirmed: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    transport_booked: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    picked_up: 'bg-purple-50 text-purple-700 ring-purple-600/20',
    at_warehouse: 'bg-purple-50 text-purple-700 ring-purple-600/20',
    in_outbound_shipment: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    in_transit: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    delivered: 'bg-green-50 text-green-700 ring-green-600/20',
    intake_registered: 'bg-green-50 text-green-700 ring-green-600/20',
    cancelled: 'bg-red-50 text-red-700 ring-red-600/20',
  }

  const label = labelMap[status] ?? status
  const color = colorMap[status] ?? 'bg-muted text-muted-foreground ring-muted'

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-mono font-medium ring-1 ring-inset ${color}`}
    >
      {label}
    </span>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function PickupActivityCard({
  active,
  recent,
}: {
  active: ActivePickup[]
  recent: RecentPickup[]
}) {
  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="mb-4 font-heading text-[15px] font-semibold">Pickup Activity</h2>

      {/* Active pickup status counts */}
      <div className="mb-5">
        <p className="mb-2 text-[12px] font-mono text-muted-foreground uppercase tracking-wide">
          Active Pickups
        </p>
        {active.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No active pickups.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {active.map((row) => (
              <div
                key={row.status}
                className="flex items-center gap-1.5"
              >
                <StatusBadge status={row.status} />
                <span className="text-[13px] font-mono text-foreground">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent pickups list */}
      <div>
        <p className="mb-2 text-[12px] font-mono text-muted-foreground uppercase tracking-wide">
          Recent Requests
        </p>
        {recent.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No pickups yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((pickup) => (
              <li key={pickup.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/pickups/${pickup.id}`}
                    className="font-mono text-[13px] font-medium text-foreground hover:underline"
                  >
                    {pickup.reference}
                  </Link>
                  <StatusBadge status={pickup.status} />
                </div>
                <span className="text-[12px] text-muted-foreground">
                  {formatRelativeDate(pickup.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
