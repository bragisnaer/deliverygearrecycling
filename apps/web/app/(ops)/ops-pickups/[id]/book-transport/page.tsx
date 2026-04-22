import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { auth } from '@/auth'
import { withRLSContext, pickups, transportProviders, prisonFacilities } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import { BookTransportForm } from './book-transport-form'

interface BookTransportPageProps {
  params: Promise<{ id: string }>
}

export default async function BookTransportPage({ params }: BookTransportPageProps) {
  await requireAuth(['reco-admin'])
  const session = await auth()
  const user = {
    ...session!.user!,
    sub: session!.user!.id!,
  }

  const { id } = await params

  // Fetch pickup and verify status is confirmed
  const pickupRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: pickups.id,
        reference: pickups.reference,
        status: pickups.status,
      })
      .from(pickups)
      .where(eq(pickups.id, id))
      .limit(1)
  })

  const pickup = pickupRows[0]
  if (!pickup) {
    notFound()
  }

  if (pickup.status !== 'confirmed') {
    redirect(`/ops-pickups/${id}`)
  }

  // Fetch all active transport providers
  const providers = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: transportProviders.id,
        name: transportProviders.name,
        provider_type: transportProviders.provider_type,
      })
      .from(transportProviders)
      .where(eq(transportProviders.active, true))
  })

  // Fetch all active prison facilities
  const facilities = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: prisonFacilities.id,
        name: prisonFacilities.name,
        address: prisonFacilities.address,
      })
      .from(prisonFacilities)
      .where(eq(prisonFacilities.active, true))
  })

  return (
    <div className="max-w-2xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/ops-pickups" className="hover:text-foreground hover:underline">
          Pickups
        </Link>
        <span>/</span>
        <Link
          href={`/ops-pickups/${id}`}
          className="hover:text-foreground hover:underline font-mono"
        >
          {pickup.reference || id}
        </Link>
        <span>/</span>
        <span className="text-foreground">Book Transport</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
          Book Transport
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Assign a transport provider to pickup{' '}
          <span className="font-mono">{pickup.reference || id}</span>
        </p>
      </div>

      {/* Form */}
      <section className="rounded-xl border border-border p-6">
        <BookTransportForm
          pickupId={pickup.id}
          providers={providers}
          prisonFacilities={facilities}
        />
      </section>
    </div>
  )
}
