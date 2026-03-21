import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'

type PrisonPipelineRow = {
  facility_name: string
  awaiting: number
  processing: number
  ready: number
  shipped: number
}

type PrisonPipelineCardProps = {
  data: PrisonPipelineRow[]
}

export default function PrisonPipelineCard({ data }: PrisonPipelineCardProps) {
  if (data.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No active prison pipeline data.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Facility</TableHead>
          <TableHead>Awaiting</TableHead>
          <TableHead>Processing</TableHead>
          <TableHead>Ready to Ship</TableHead>
          <TableHead>Shipped</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.facility_name}>
            <TableCell className="text-[13px]">{row.facility_name}</TableCell>
            <TableCell className="font-mono text-[13px]">
              {row.awaiting}
            </TableCell>
            <TableCell className="font-mono text-[13px]">
              {row.processing}
            </TableCell>
            <TableCell className="font-mono text-[13px]">
              {row.ready}
            </TableCell>
            <TableCell className="font-mono text-[13px]">
              {row.shipped}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
