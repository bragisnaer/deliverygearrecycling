import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { withRLSContext, pickups, locations } from '@repo/db'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

const STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  transport_booked: 'bg-purple-100 text-purple-800',
  picked_up: 'bg-indigo-100 text-indigo-800',
  at_warehouse: 'bg-cyan-100 text-cyan-800',
  in_outbound_shipment: 'bg-teal-100 text-teal-800',
  in_transit: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  intake_registered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600',
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ClientPickupsPage() {
  const { user } = await requireAuth(['client', 'client-global'])
  const session = await auth()
  const claims = { ...session!.user!, sub: session!.user!.id! }

  const pickupList = await withRLSContext(claims, async (tx) => {
    // client role: filter by location_id; client-global: show all tenant pickups
    if (user.role === 'client' && user.location_id) {
      return tx
        .select({
          id: pickups.id,
          reference: pickups.reference,
          status: pickups.status,
          pallet_count: pickups.pallet_count,
          preferred_date: pickups.preferred_date,
          created_at: pickups.created_at,
        })
        .from(pickups)
        .where(eq(pickups.location_id, user.location_id))
        .orderBy(pickups.created_at)
    }

    // client-global: all tenant pickups (RLS handles tenant scoping)
    return tx
      .select({
        id: pickups.id,
        reference: pickups.reference,
        status: pickups.status,
        pallet_count: pickups.pallet_count,
        preferred_date: pickups.preferred_date,
        created_at: pickups.created_at,
      })
      .from(pickups)
      .orderBy(pickups.created_at)
  })

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">My Pickups</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            View and manage your pickup requests.
          </p>
        </div>
        <Button render={<Link href="/pickups/new" />}>New Pickup</Button>
      </div>

      {pickupList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[14px] text-muted-foreground">No pickups found.</p>
          <Button className="mt-4" render={<Link href="/pickups/new" />}>
            Book your first pickup
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pallets</TableHead>
              <TableHead>Preferred Date</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pickupList.map((pickup) => (
              <TableRow key={pickup.id}>
                <TableCell>
                  <Link
                    href={`/pickups/${pickup.id}`}
                    className="font-mono text-[13px] font-medium text-foreground hover:underline"
                  >
                    {pickup.reference || '—'}
                  </Link>
                </TableCell>
                <TableCell>
                  <span
                    className={[
                      'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium capitalize',
                      STATUS_BADGE[pickup.status] ?? 'bg-gray-100 text-gray-600',
                    ].join(' ')}
                  >
                    {pickup.status.replace(/_/g, ' ')}
                  </span>
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {pickup.pallet_count}
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {formatDate(pickup.preferred_date)}
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">
                  {formatDate(pickup.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
