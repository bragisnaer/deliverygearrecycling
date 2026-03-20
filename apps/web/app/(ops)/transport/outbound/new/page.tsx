import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisonFacilities, transportProviders, withRLSContext } from '@repo/db'
import { eq } from 'drizzle-orm'
import { getWarehouseInventory } from '../actions'
import { OutboundShipmentForm } from './outbound-shipment-form'

export default async function NewOutboundShipmentPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    redirect('/sign-in')
  }

  const claims = {
    ...session.user,
    sub: session.user.id!,
  }

  const [{ pickups: heldPickups }, facilities, providers] = await Promise.all([
    getWarehouseInventory(),
    withRLSContext(claims, async (tx) =>
      tx
        .select({
          id: prisonFacilities.id,
          name: prisonFacilities.name,
          address: prisonFacilities.address,
        })
        .from(prisonFacilities)
        .where(eq(prisonFacilities.active, true))
        .orderBy(prisonFacilities.name)
    ),
    withRLSContext(claims, async (tx) =>
      tx
        .select({ id: transportProviders.id, name: transportProviders.name })
        .from(transportProviders)
        .where(eq(transportProviders.active, true))
        .orderBy(transportProviders.name)
    ),
  ])

  return (
    <div className="max-w-5xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/transport/outbound" className="hover:text-foreground hover:underline">
          Warehouse Inventory
        </Link>
        <span>/</span>
        <span className="text-foreground">New Outbound Shipment</span>
      </div>

      {/* Page heading */}
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
          Create Outbound Shipment
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Select held pickups, enter the warehouse-to-prison transport cost, and confirm
          the pro-rata cost allocation.
        </p>
      </div>

      <OutboundShipmentForm
        pickups={heldPickups}
        prisonFacilities={facilities}
        transportProviders={providers}
      />
    </div>
  )
}
