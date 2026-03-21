import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { VolumeByQuarterRow } from '../actions'

export default function VolumeByQuarterTable({
  data,
  isGlobal,
}: {
  data: VolumeByQuarterRow[]
  isGlobal: boolean
}) {
  if (!isGlobal) {
    return (
      <section className="rounded-xl border border-border p-5">
        <h2 className="mb-4 font-heading text-[15px] font-semibold">Volume by Quarter</h2>
        {data.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No intake data available yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarter</TableHead>
                <TableHead className="text-right">Items</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.quarter}>
                  <TableCell className="font-mono text-[13px]">{row.quarter}</TableCell>
                  <TableCell className="text-right font-mono text-[13px]">
                    {row.item_count.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    )
  }

  // Client-global: group by quarter, show location subtotals
  // Build a map of quarter -> { location -> count }
  const quarterMap = new Map<string, { location: string; count: number }[]>()
  for (const row of data) {
    const entries = quarterMap.get(row.quarter) ?? []
    entries.push({ location: row.location_name ?? 'Unknown', count: row.item_count })
    quarterMap.set(row.quarter, entries)
  }

  const quarters = Array.from(quarterMap.keys()).sort().reverse()

  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="mb-4 font-heading text-[15px] font-semibold">Volume by Quarter</h2>
      {quarters.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No intake data available yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quarter</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Items</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quarters.map((quarter) => {
              const rows = quarterMap.get(quarter) ?? []
              const subtotal = rows.reduce((sum, r) => sum + r.count, 0)
              return (
                <>
                  {rows.map((row) => (
                    <TableRow key={`${quarter}-${row.location}`}>
                      <TableCell className="font-mono text-[13px] text-muted-foreground">
                        {quarter}
                      </TableCell>
                      <TableCell className="text-[13px]">{row.location}</TableCell>
                      <TableCell className="text-right font-mono text-[13px]">
                        {row.count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow key={`${quarter}-subtotal`} className="bg-muted/30">
                    <TableCell className="font-mono text-[13px] font-semibold">
                      {quarter}
                    </TableCell>
                    <TableCell className="text-[12px] font-mono text-muted-foreground uppercase tracking-wide">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-mono text-[13px] font-semibold">
                      {subtotal.toLocaleString()}
                    </TableCell>
                  </TableRow>
                </>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
