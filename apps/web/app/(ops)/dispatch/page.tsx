import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { getDispatchList } from './actions'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    created: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    picked_up: 'bg-blue-100 text-blue-800 border-blue-200',
    delivered: 'bg-green-100 text-green-800 border-green-200',
  }
  const labels: Record<string, string> = {
    created: 'Created',
    picked_up: 'Picked Up',
    delivered: 'Delivered',
  }
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[12px] font-medium',
        variants[status] ?? 'bg-gray-100 text-gray-600 border-gray-200',
      ].join(' ')}
    >
      {labels[status] ?? status}
    </span>
  )
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function OpsDispatchPage() {
  await requireAuth(['reco-admin', 'reco'])
  const dispatches = await getDispatchList()

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">Dispatches</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Outbound dispatch records from prison facilities to redistribution partner.
          </p>
        </div>
        <Link
          href="/dispatch/new"
          className="inline-flex h-9 items-center rounded-md bg-foreground px-4 font-mono text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Create Dispatch
        </Link>
      </div>

      {dispatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[14px] text-muted-foreground">
            No dispatches yet. Create the first dispatch to get started.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Carrier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Lines</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dispatches.map((dispatch) => (
              <TableRow key={dispatch.id} className="cursor-pointer hover:bg-muted/30">
                <TableCell>
                  <Link
                    href={`/dispatch/${dispatch.id}`}
                    className="block font-mono text-[13px] hover:underline"
                  >
                    {formatDate(dispatch.dispatch_date)}
                  </Link>
                </TableCell>
                <TableCell className="text-[13px]">
                  {dispatch.facility_name ?? '—'}
                </TableCell>
                <TableCell className="text-[13px]">{dispatch.destination}</TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {dispatch.carrier ?? '—'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={dispatch.status} />
                </TableCell>
                <TableCell className="text-right font-mono text-[13px] text-muted-foreground">
                  {dispatch.line_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
