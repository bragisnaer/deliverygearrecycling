import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MaterialWeightRow } from '@/lib/esg-calculator'

type MaterialBreakdownTableProps = {
  rows: MaterialWeightRow[]
}

export default function MaterialBreakdownTable({ rows }: MaterialBreakdownTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No intake data available for ESG calculations.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Material</TableHead>
          <TableHead className="text-right">Weight (kg)</TableHead>
          <TableHead className="text-right">Items</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.material_name}>
            <TableCell>{row.material_name}</TableCell>
            <TableCell className="text-right font-mono">
              {row.total_weight_kg.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono">
              {row.item_count.toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
