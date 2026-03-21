import Link from 'next/link'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'

type ConsolidationAgeingRow = {
  pickup_id: string
  reference: string
  client_name: string
  pallet_count: number
  arrival_date: string
  days_held: number
}

function daysHeldColor(days: number): string {
  if (days > 14) return 'text-red-600 font-mono text-[13px]'
  if (days >= 7) return 'text-amber-600 font-mono text-[13px]'
  return 'text-green-700 font-mono text-[13px]'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB')
}

type ConsolidationAgeingTableProps = {
  data: ConsolidationAgeingRow[]
}

export default function ConsolidationAgeingTable({
  data,
}: ConsolidationAgeingTableProps) {
  if (data.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No pallets at consolidation warehouses.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Pallets</TableHead>
          <TableHead>Arrival Date</TableHead>
          <TableHead>Days Held</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.pickup_id}>
            <TableCell>
              <Link
                href={`/pickups/${row.pickup_id}`}
                className="font-mono text-[13px] underline underline-offset-2 hover:text-foreground"
              >
                {row.reference}
              </Link>
            </TableCell>
            <TableCell className="text-[13px]">{row.client_name}</TableCell>
            <TableCell className="font-mono text-[13px]">
              {row.pallet_count}
            </TableCell>
            <TableCell className="font-mono text-[13px]">
              {formatDate(row.arrival_date)}
            </TableCell>
            <TableCell className={daysHeldColor(row.days_held)}>
              {row.days_held}d
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
