type EsgSummaryCardProps = {
  title: string
  value: string | number
  subtitle?: string
  pending?: boolean
}

export default function EsgSummaryCard({
  title,
  value,
  subtitle,
  pending,
}: EsgSummaryCardProps) {
  return (
    <div className="rounded-xl border border-border p-5">
      <p className="text-[13px] font-mono text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      {pending ? (
        <p className="mt-2 text-[28px] font-heading font-semibold text-muted-foreground italic">
          Pending
        </p>
      ) : (
        <p className="mt-2 text-[28px] font-heading font-semibold">{value}</p>
      )}
      {subtitle && (
        <p className="mt-1 text-[12px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )
}
