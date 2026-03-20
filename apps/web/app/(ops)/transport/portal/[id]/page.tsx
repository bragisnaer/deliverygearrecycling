import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import {
  transportBookings,
  pickups,
  locations,
  withRLSContext,
} from '@repo/db'
import { eq } from 'drizzle-orm'
import {
  updateShipmentStatus,
  markArrivedAtWarehouse,
  addDeliveryNotes,
  uploadProofOfDelivery,
} from '../actions'
import { getStorageClient } from '@/lib/storage'

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  confirmed: 'Confirmed',
  transport_booked: 'Awaiting Collection',
  picked_up: 'Picked Up',
  at_warehouse: 'At Warehouse',
  in_outbound_shipment: 'In Outbound Shipment',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  intake_registered: 'Intake Registered',
  cancelled: 'Cancelled',
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

interface TransportPortalDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TransportPortalDetailPage({
  params,
}: TransportPortalDetailPageProps) {
  const { id } = await params
  const { user } = await requireAuth(['transport'])

  const claims = { ...user, sub: user.id }

  const rows = await withRLSContext(claims, async (tx) => {
    return tx
      .select({
        // Booking — NO pricing or prison columns
        booking_id: transportBookings.id,
        transport_type: transportBookings.transport_type,
        confirmed_pickup_date: transportBookings.confirmed_pickup_date,
        delivery_notes: transportBookings.delivery_notes,
        proof_of_delivery_path: transportBookings.proof_of_delivery_path,
        // Pickup
        pickup_id: pickups.id,
        reference: pickups.reference,
        status: pickups.status,
        pallet_count: pickups.pallet_count,
        preferred_date: pickups.preferred_date,
        // Location
        location_name: locations.name,
        location_address: locations.address,
      })
      .from(transportBookings)
      .innerJoin(pickups, eq(transportBookings.pickup_id, pickups.id))
      .innerJoin(locations, eq(pickups.location_id, locations.id))
      .where(eq(transportBookings.id, id))
      .limit(1)
  })

  const booking = rows[0]
  if (!booking) notFound()

  // Generate signed URL for existing POD if present
  let podSignedUrl: string | null = null
  if (booking.proof_of_delivery_path) {
    try {
      const bucket = getStorageClient().from('proof-of-delivery')
      const { data } = await bucket.createSignedUrl(booking.proof_of_delivery_path, 3600)
      podSignedUrl = data?.signedUrl ?? null
    } catch {
      // Storage unavailable — skip POD link
    }
  }

  const canMarkPickedUp = booking.status === 'transport_booked'
  const canMarkInTransit =
    booking.status === 'picked_up' && booking.transport_type === 'direct'
  const canMarkAtWarehouse =
    booking.status === 'picked_up' && booking.transport_type === 'consolidation'

  return (
    <div className="max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/transport/portal" className="hover:text-foreground hover:underline">
          My Pickups
        </Link>
        <span>/</span>
        <span className="text-foreground font-mono">{booking.reference || id}</span>
      </div>

      {/* Heading */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
            Pickup {booking.reference || '—'}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {booking.location_name} — {booking.location_address}
          </p>
        </div>
        {/* Transport type badge */}
        <span
          className={[
            'mt-1 inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[12px] font-medium',
            booking.transport_type === 'consolidation'
              ? 'bg-purple-100 text-purple-800'
              : 'bg-blue-100 text-blue-800',
          ].join(' ')}
        >
          {booking.transport_type === 'consolidation' ? 'Consolidation' : 'Direct'}
        </span>
      </div>

      {/* Details grid */}
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-xl border border-border p-6 text-[14px]">
        <div>
          <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">
            Status
          </dt>
          <dd className="mt-1">
            <span
              className={[
                'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium capitalize',
                STATUS_BADGE[booking.status] ?? 'bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {STATUS_LABEL[booking.status] ?? booking.status.replace(/_/g, ' ')}
            </span>
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">
            Pallets
          </dt>
          <dd className="mt-1 font-medium">{booking.pallet_count}</dd>
        </div>
        <div>
          <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">
            Preferred Date
          </dt>
          <dd className="mt-1">{formatDate(booking.preferred_date)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wider">
            Confirmed Pickup Date
          </dt>
          <dd className="mt-1">{formatDate(booking.confirmed_pickup_date)}</dd>
        </div>
      </dl>

      {/* Status actions */}
      {(canMarkPickedUp || canMarkInTransit || canMarkAtWarehouse) && (
        <section className="space-y-3">
          <h2 className="text-[16px] font-semibold">Update Status</h2>
          <div className="flex flex-wrap gap-3">
            {canMarkPickedUp && (
              <form
                action={async () => {
                  'use server'
                  await updateShipmentStatus(booking.booking_id, 'picked_up')
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg border border-border bg-foreground px-4 py-2 font-mono text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  Mark Picked Up
                </button>
              </form>
            )}
            {canMarkInTransit && (
              <form
                action={async () => {
                  'use server'
                  await updateShipmentStatus(booking.booking_id, 'in_transit')
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg border border-border bg-foreground px-4 py-2 font-mono text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  Mark In Transit
                </button>
              </form>
            )}
            {canMarkAtWarehouse && (
              <form
                action={async () => {
                  'use server'
                  await markArrivedAtWarehouse(booking.booking_id)
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg border border-border bg-foreground px-4 py-2 font-mono text-[13px] font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  Mark Arrived at Warehouse
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      <hr className="border-border" />

      {/* Delivery notes */}
      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold">Delivery Notes</h2>
        <form
          action={async (formData: FormData) => {
            'use server'
            const notes = formData.get('notes') as string
            await addDeliveryNotes(booking.booking_id, notes ?? '')
          }}
          className="space-y-3"
        >
          <textarea
            name="notes"
            defaultValue={booking.delivery_notes ?? ''}
            rows={4}
            placeholder="Add delivery notes, access instructions, or other relevant information..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20 resize-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-border bg-background px-4 py-2 font-mono text-[13px] font-medium transition-colors hover:bg-muted"
          >
            Save Notes
          </button>
        </form>
      </section>

      <hr className="border-border" />

      {/* Proof of delivery */}
      <section className="space-y-3">
        <h2 className="text-[16px] font-semibold">Proof of Delivery</h2>

        {podSignedUrl && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
            <span className="text-[13px] text-muted-foreground">Current POD:</span>
            <a
              href={podSignedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[13px] text-primary hover:underline"
            >
              Download
            </a>
          </div>
        )}

        <form
          action={async (formData: FormData) => {
            'use server'
            await uploadProofOfDelivery(booking.booking_id, formData)
          }}
          className="space-y-3"
        >
          <div className="rounded-lg border border-dashed border-border p-4">
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="w-full font-mono text-[13px] text-muted-foreground file:mr-3 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1 file:font-mono file:text-[12px] file:text-foreground hover:file:bg-muted"
            />
            <p className="mt-2 text-[12px] text-muted-foreground">
              JPEG, PNG, WebP, or PDF — max 10MB. Uploading replaces the existing POD.
            </p>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-border bg-background px-4 py-2 font-mono text-[13px] font-medium transition-colors hover:bg-muted"
          >
            Upload Proof of Delivery
          </button>
        </form>
      </section>
    </div>
  )
}
