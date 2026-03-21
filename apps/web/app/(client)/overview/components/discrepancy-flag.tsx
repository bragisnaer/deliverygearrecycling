import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SentVsReceivedRow } from '../actions'

function DiscrepancyCell({ pct }: { pct: number }) {
  if (pct > 15) {
    return (
      <span className="font-mono text-[13px] font-bold text-red-600">{pct.toFixed(1)}%</span>
    )
  }
  if (pct >= 5) {
    return (
      <span className="font-mono text-[13px] font-medium text-amber-600">{pct.toFixed(1)}%</span>
    )
  }
  return (
    <span className="font-mono text-[13px] text-green-600">{pct.toFixed(1)}%</span>
  )
}

export default function DiscrepancyFlag({
  data,
  isGlobal,
}: {
  data: SentVsReceivedRow[]
  isGlobal: boolean
}) {
  return (
    <section className="rounded-xl border border-border p-5">
      <h2 className="mb-1 font-heading text-[15px] font-semibold">Sent vs Received</h2>
      <p className="mb-4 text-[12px] text-muted-foreground">
        Last 90 days. Items sent at pickup vs items counted at intake.
      </p>

      {data.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No delivery comparisons available yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              {isGlobal && <TableHead>Location</TableHead>}
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Discrepancy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, i) => (
              <TableRow key={`${row.product_name}-${row.location_name ?? ''}-${i}`}>
                <TableCell className="font-medium text-[13px]">{row.product_name}</TableCell>
                {isGlobal && (
                  <TableCell className="text-[13px] text-muted-foreground">
                    {row.location_name ?? '—'}
                  </TableCell>
                )}
                <TableCell className="text-right font-mono text-[13px]">
                  {row.sent.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-[13px]">
                  {row.received.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <DiscrepancyCell pct={Number(row.discrepancy_pct)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )
}
