type TransportStatsCounts = {
  awaiting: number
  inTransit: number
  atWarehouse: number
  completed: number
}

const STAT_CARDS = [
  { label: 'Awaiting Collection', key: 'awaiting' as const },
  { label: 'In Transit', key: 'inTransit' as const },
  { label: 'At Warehouse', key: 'atWarehouse' as const },
  { label: 'Completed (30d)', key: 'completed' as const },
]

export function TransportStats({ counts }: { counts: TransportStatsCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STAT_CARDS.map((card) => (
        <div
          key={card.key}
          className="rounded-xl border border-border bg-background p-4"
        >
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            {card.label}
          </p>
          <p className="mt-2 text-[22px] font-heading font-semibold leading-none">
            {counts[card.key]}
          </p>
        </div>
      ))}
    </div>
  )
}
