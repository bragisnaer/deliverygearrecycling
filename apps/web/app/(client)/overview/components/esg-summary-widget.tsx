import type { MaterialWeightRow } from '@/lib/esg-calculator'

export default function EsgSummaryWidget({
  materials,
  reuseRate,
  totalItems,
}: {
  materials: MaterialWeightRow[]
  reuseRate: number
  totalItems: number
}) {
  const totalWeightKg = materials.reduce((sum, m) => sum + m.total_weight_kg, 0)
  const top3 = materials.slice(0, 3)

  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="mb-4 font-heading text-[15px] font-semibold">ESG Summary</h2>

      {/* Key metrics */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
          <p className="font-mono text-xl font-semibold text-foreground">
            {totalItems.toLocaleString()}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Items Processed</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
          <p className="font-mono text-xl font-semibold text-foreground">
            {totalWeightKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="text-[13px] font-normal text-muted-foreground"> kg</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Material Recovered</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-center">
          <p className="font-mono text-xl font-semibold text-foreground">
            {reuseRate.toFixed(1)}
            <span className="text-[13px] font-normal text-muted-foreground">%</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Reuse Rate</p>
        </div>
      </div>

      {/* Top materials mini-table */}
      {top3.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
            Top Materials
          </p>
          <ul className="divide-y divide-border">
            {top3.map((m) => (
              <li key={m.material_name} className="flex items-center justify-between py-1.5">
                <span className="text-[13px] text-foreground">{m.material_name}</span>
                <div className="flex items-center gap-3 text-[12px] font-mono text-muted-foreground">
                  <span>{m.item_count.toLocaleString()} items</span>
                  <span className="font-medium text-foreground">
                    {m.total_weight_kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {totalItems === 0 && (
        <p className="text-[13px] text-muted-foreground">No processed items yet.</p>
      )}
    </section>
  )
}
