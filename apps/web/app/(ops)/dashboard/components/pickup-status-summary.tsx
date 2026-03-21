type PickupStatusRow = {
  status: string
  count: number
}

// Statuses that represent active/in-progress work — get a subtle left border accent
const ACTIVE_STATUSES = new Set([
  'submitted',
  'confirmed',
  'transport_booked',
  'picked_up',
  'in_transit',
])

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

type PickupStatusSummaryProps = {
  data: PickupStatusRow[]
}

export default function PickupStatusSummary({ data }: PickupStatusSummaryProps) {
  if (data.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">No active pickups.</p>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
      {data.map((row) => (
        <div
          key={row.status}
          className={[
            'rounded-xl border border-border p-3 text-center',
            ACTIVE_STATUSES.has(row.status) ? 'border-l-2 border-l-foreground' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <p className="text-[11px] font-mono uppercase text-muted-foreground">
            {statusLabel(row.status)}
          </p>
          <p className="text-[22px] font-heading font-semibold">{row.count}</p>
        </div>
      ))}
    </div>
  )
}
