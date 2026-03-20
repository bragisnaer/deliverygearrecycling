import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { withRLSContext, pickups, pickupLines, products, locations } from '@repo/db'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { CancelPickupClientButton } from './cancel-pickup-client-button'

interface ClientPickupDetailPageProps {
  params: Promise<{ id: string }>
}

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

const TERMINAL_STATUSES = ['delivered', 'intake_registered', 'cancelled']
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatWeight(grams: string | null | undefined): string {
  if (!grams) return '—'
  const kg = parseFloat(grams) / 1000
  return `${kg.toFixed(1)} kg`
}

export default async function ClientPickupDetailPage({ params }: ClientPickupDetailPageProps) {
  await requireAuth(['client', 'client-global'])
  const { id } = await params
  const session = await auth()
  const claims = { ...session!.user!, sub: session!.user!.id! }

  // Fetch pickup — RLS enforces tenant isolation
  const rows = await withRLSContext(claims, async (tx) => {
    return tx
      .select({
        id: pickups.id,
        reference: pickups.reference,
        status: pickups.status,
        pallet_count: pickups.pallet_count,
        pallet_dimensions: pickups.pallet_dimensions,
        estimated_weight_grams: pickups.estimated_weight_grams,
        preferred_date: pickups.preferred_date,
        confirmed_date: pickups.confirmed_date,
        notes: pickups.notes,
        cancellation_reason: pickups.cancellation_reason,
        created_at: pickups.created_at,
        location_name: locations.name,
        location_address: locations.address,
      })
      .from(pickups)
      .leftJoin(locations, eq(pickups.location_id, locations.id))
      .where(eq(pickups.id, id))
      .limit(1)
  })

  const pickup = rows[0]
  if (!pickup) {
    notFound()
  }

  // Fetch pickup lines
  const lines = await withRLSContext(claims, async (tx) => {
    return tx
      .select({
        id: pickupLines.id,
        quantity: pickupLines.quantity,
        product_name: products.name,
        product_code: products.product_code,
      })
      .from(pickupLines)
      .leftJoin(products, eq(pickupLines.product_id, products.id))
      .where(eq(pickupLines.pickup_id, id))
  })

  // Determine cancel eligibility:
  // - Not in terminal status
  // - If confirmed_date exists, must be more than 24h away
  const isTerminal = TERMINAL_STATUSES.includes(pickup.status)
  let canCancel = !isTerminal

  if (canCancel && pickup.confirmed_date) {
    const confirmedAt = new Date(pickup.confirmed_date).getTime()
    const timeUntilPickup = confirmedAt - Date.now()
    // PICKUP-06: client can cancel up to 24h before confirmed date
    canCancel = timeUntilPickup > TWENTY_FOUR_HOURS_MS
  }

  return (
    <div className="max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/pickups" className="hover:text-foreground hover:underline">
          My Pickups
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground">{pickup.reference || id}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
            {pickup.reference || 'Pickup Detail'}
          </h1>
          <div className="mt-2">
            <span
              className={[
                'inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[12px] font-medium capitalize',
                STATUS_BADGE[pickup.status] ?? 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {pickup.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Cancel button — only shown if eligible */}
        {canCancel && <CancelPickupClientButton pickupId={pickup.id} />}
      </div>

      {/* Pickup details */}
      <section className="space-y-4 rounded-xl border border-border p-6">
        <h2 className="text-[16px] font-semibold">Pickup Details</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-[14px]">
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Location</dt>
            <dd className="mt-1">{pickup.location_name ?? '—'}</dd>
            {pickup.location_address && (
              <dd className="text-[13px] text-muted-foreground">{pickup.location_address}</dd>
            )}
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Pallet Count</dt>
            <dd className="mt-1">{pickup.pallet_count}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Pallet Dimensions</dt>
            <dd className="mt-1">{pickup.pallet_dimensions ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Est. Weight</dt>
            <dd className="mt-1">{formatWeight(pickup.estimated_weight_grams)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Preferred Date</dt>
            <dd className="mt-1">{formatDate(pickup.preferred_date)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Confirmed Date</dt>
            <dd className="mt-1">{formatDate(pickup.confirmed_date)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Submitted</dt>
            <dd className="mt-1">{formatDate(pickup.created_at)}</dd>
          </div>
          {pickup.notes && (
            <div className="col-span-2">
              <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Notes</dt>
              <dd className="mt-1">{pickup.notes}</dd>
            </div>
          )}
          {pickup.cancellation_reason && (
            <div className="col-span-2">
              <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Cancellation Reason</dt>
              <dd className="mt-1 rounded-md bg-red-50 p-3 text-[14px] text-red-800">
                {pickup.cancellation_reason}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* 24h cancellation notice */}
      {!isTerminal && !canCancel && pickup.confirmed_date && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 text-[14px] text-yellow-800">
          This pickup is within 24 hours of its confirmed date and can no longer be cancelled. Please contact reco if you need assistance.
        </div>
      )}

      {/* Product lines */}
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold">Product Lines</h2>
        {lines.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">No product lines recorded.</p>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Product</th>
                <th className="pb-2 font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Code</th>
                <th className="pb-2 text-right font-mono text-[12px] text-muted-foreground uppercase tracking-wide">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-border last:border-0">
                  <td className="py-3">{line.product_name ?? '—'}</td>
                  <td className="py-3 font-mono text-[13px] text-muted-foreground">
                    {line.product_code ?? '—'}
                  </td>
                  <td className="py-3 text-right">{line.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
