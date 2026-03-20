import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { withRLSContext, products, locations } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import { PickupBookingForm } from './pickup-booking-form'

export default async function NewPickupPage() {
  const { user } = await requireAuth(['client', 'client-global'])

  // Fetch user's assigned location (read-only per PICKUP-03 decision)
  const locationId = user.location_id ?? ''
  const claims = { ...user, sub: user.id, role: user.role }

  const locationRows = locationId
    ? await withRLSContext(claims, async (tx) => {
        return tx
          .select({
            id: locations.id,
            name: locations.name,
            address: locations.address,
            country: locations.country,
          })
          .from(locations)
          .where(eq(locations.id, locationId))
          .limit(1)
      })
    : []

  const location = locationRows[0] ?? null

  // Fetch active products for the user's tenant
  const tenantId = user.tenant_id ?? ''
  const activeProducts = await withRLSContext(claims, async (tx) => {
    return tx
      .select({
        id: products.id,
        name: products.name,
        product_code: products.product_code,
        weight_grams: products.weight_grams,
      })
      .from(products)
      .where(and(eq(products.tenant_id, tenantId), eq(products.active, true)))
      .orderBy(products.name)
  })

  return (
    <div className="max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/pickups" className="hover:text-foreground hover:underline">
          Pickups
        </Link>
        <span>/</span>
        <span className="text-foreground">New Pickup Request</span>
      </div>

      {/* Page heading */}
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
          Book a Pickup
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Submit a gear collection request. Minimum 72 hours lead time required.
        </p>
      </div>

      {/* Location display (read-only — client cannot change their location) */}
      {location ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-1">
          <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            Pickup Location
          </p>
          <p className="text-[14px] font-medium">{location.name}</p>
          <p className="text-[13px] text-muted-foreground">
            {location.address}, {location.country}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
          <p className="text-[13px] text-destructive">
            No location assigned to your account. Please contact support.
          </p>
        </div>
      )}

      {/* Booking form (Client Component) */}
      <PickupBookingForm
        products={activeProducts.map((p) => ({
          id: p.id,
          name: p.name,
          product_code: p.product_code,
          weight_grams: p.weight_grams ?? null,
        }))}
        locationId={locationId}
      />
    </div>
  )
}
