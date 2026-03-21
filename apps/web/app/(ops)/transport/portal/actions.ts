'use server'

import { auth } from '@/auth'
import {
  db,
  transportBookings,
  transportProviders,
  outboundShipments,
  outboundShipmentPickups,
  pickups,
  locations,
  tenants,
  withRLSContext,
} from '@repo/db'
import { eq, and, gte, desc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getStorageClient } from '@/lib/storage'

// --- Auth helpers ---

async function requireTransport() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'transport') {
    throw new Error('Unauthorized: transport role required')
  }
  const user = session.user
  return {
    ...user,
    sub: user.id!,
  }
}

// --- Read actions ---

/**
 * Fetch all transport bookings assigned to the authenticated transport provider.
 * RLS automatically filters to their linked clients only.
 * Pricing columns (transport_cost_market_to_destination_eur) and prison data
 * (prison_facility_id) are explicitly excluded per TRANS-08.
 */
export async function getAssignedPickups() {
  const user = await requireTransport()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        // Booking fields — NO pricing or prison columns
        booking_id: transportBookings.id,
        transport_type: transportBookings.transport_type,
        confirmed_pickup_date: transportBookings.confirmed_pickup_date,
        delivery_notes: transportBookings.delivery_notes,
        proof_of_delivery_path: transportBookings.proof_of_delivery_path,
        // Pickup fields
        pickup_id: pickups.id,
        reference: pickups.reference,
        status: pickups.status,
        pallet_count: pickups.pallet_count,
        preferred_date: pickups.preferred_date,
        // Location fields
        location_name: locations.name,
        location_address: locations.address,
      })
      .from(transportBookings)
      .innerJoin(pickups, eq(transportBookings.pickup_id, pickups.id))
      .innerJoin(locations, eq(pickups.location_id, locations.id))
  })

  // Group by status category
  const awaiting_collection = rows.filter((r) => r.status === 'transport_booked')
  const at_warehouse = rows.filter((r) => r.status === 'at_warehouse')
  const in_transit = rows.filter((r) => r.status === 'picked_up' || r.status === 'in_transit')
  const completed = rows.filter(
    (r) =>
      r.status === 'delivered' &&
      r.confirmed_pickup_date != null &&
      new Date(r.confirmed_pickup_date) >= thirtyDaysAgo
  )

  return { awaiting_collection, at_warehouse, in_transit, completed }
}

/**
 * Get the transport provider record for the current user.
 * Returns provider_type and name, or null if no provider found.
 */
export async function getTransportProviderInfo(): Promise<{
  provider_type: 'direct' | 'consolidation'
  provider_name: string
} | null> {
  const user = await requireTransport()

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        provider_type: transportProviders.provider_type,
        name: transportProviders.name,
      })
      .from(transportProviders)
      .where(eq(transportProviders.user_id, user.id!))
      .limit(1)
  })

  if (!rows[0]) return null
  return {
    provider_type: rows[0].provider_type,
    provider_name: rows[0].name,
  }
}

/**
 * Get warehouse inventory for consolidation providers.
 * Returns pickups with status 'at_warehouse' linked to this provider's bookings.
 */
export async function getWarehouseInventory(): Promise<
  {
    pickup_id: string
    reference: string
    client_name: string
    product_summary: string
    pallet_count: number
    arrival_date: string
    days_held: number
  }[]
> {
  const user = await requireTransport()

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        pickup_id: pickups.id,
        reference: pickups.reference,
        client_name: tenants.name,
        pallet_count: pickups.pallet_count,
        notes: pickups.notes,
        confirmed_pickup_date: transportBookings.confirmed_pickup_date,
        updated_at: pickups.updated_at,
      })
      .from(transportBookings)
      .innerJoin(pickups, eq(transportBookings.pickup_id, pickups.id))
      .innerJoin(tenants, eq(pickups.tenant_id, tenants.id))
      .where(eq(pickups.status, 'at_warehouse'))
  })

  const now = new Date()
  return rows
    .map((r) => {
      const arrivalDate = r.confirmed_pickup_date ?? r.updated_at
      const daysHeld = Math.floor(
        (now.getTime() - new Date(arrivalDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      return {
        pickup_id: r.pickup_id,
        reference: r.reference,
        client_name: r.client_name,
        product_summary: r.notes ?? '—',
        pallet_count: r.pallet_count,
        arrival_date: new Date(arrivalDate).toISOString().slice(0, 10),
        days_held: daysHeld,
      }
    })
    .sort((a, b) => b.days_held - a.days_held)
}

/**
 * Get outbound shipment history for the current provider (last 30 days).
 * Returns shipments with pickup count.
 */
export async function getOutboundShipmentHistory(): Promise<
  {
    id: string
    destination: string
    status: string
    pickup_count: number
    created_at: string
  }[]
> {
  const user = await requireTransport()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get the provider id first, then fetch shipments
  const providerRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: transportProviders.id })
      .from(transportProviders)
      .where(eq(transportProviders.user_id, user.id!))
      .limit(1)
  })

  if (!providerRows[0]) return []
  const providerId = providerRows[0].id

  const shipments = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: outboundShipments.id,
        prison_facility_id: outboundShipments.prison_facility_id,
        status: outboundShipments.status,
        created_at: outboundShipments.created_at,
      })
      .from(outboundShipments)
      .where(
        and(
          eq(outboundShipments.transport_provider_id, providerId),
          gte(outboundShipments.created_at, thirtyDaysAgo)
        )
      )
      .orderBy(desc(outboundShipments.created_at))
  })

  if (shipments.length === 0) return []

  // Count pickups per shipment
  const shipmentIds = shipments.map((s) => s.id)
  const pickupCounts = await withRLSContext(user, async (tx) => {
    const counts: Record<string, number> = {}
    for (const shipmentId of shipmentIds) {
      const rows = await tx
        .select({ pickup_id: outboundShipmentPickups.pickup_id })
        .from(outboundShipmentPickups)
        .where(eq(outboundShipmentPickups.outbound_shipment_id, shipmentId))
      counts[shipmentId] = rows.length
    }
    return counts
  })

  return shipments.map((s) => ({
    id: s.id,
    destination: `Facility ${s.prison_facility_id.slice(0, 8)}`,
    status: s.status,
    pickup_count: pickupCounts[s.id] ?? 0,
    created_at: new Date(s.created_at).toISOString().slice(0, 10),
  }))
}

// --- Write actions ---

/**
 * Update pickup shipment status. Allowed transitions for transport role:
 * transport_booked -> picked_up, picked_up -> in_transit
 */
export async function updateShipmentStatus(
  bookingId: string,
  newStatus: 'picked_up' | 'in_transit'
) {
  const validatedId = z.string().uuid().parse(bookingId)
  const user = await requireTransport()

  await withRLSContext(user, async (tx) => {
    // Fetch current booking and linked pickup status
    const [booking] = await tx
      .select({
        id: transportBookings.id,
        pickup_id: transportBookings.pickup_id,
        pickup_status: pickups.status,
      })
      .from(transportBookings)
      .innerJoin(pickups, eq(transportBookings.pickup_id, pickups.id))
      .where(eq(transportBookings.id, validatedId))
      .limit(1)

    if (!booking) throw new Error('Booking not found')

    // Validate allowed status transitions
    const allowedTransitions: Record<string, string[]> = {
      transport_booked: ['picked_up'],
      picked_up: ['in_transit'],
    }

    const allowed = allowedTransitions[booking.pickup_status] ?? []
    if (!allowed.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: ${booking.pickup_status} -> ${newStatus}`
      )
    }

    // Update linked pickup status
    await tx
      .update(pickups)
      .set({ status: newStatus, updated_at: new Date() })
      .where(eq(pickups.id, booking.pickup_id))

    // Update booking updated_at
    await tx
      .update(transportBookings)
      .set({ updated_at: new Date() })
      .where(eq(transportBookings.id, validatedId))
  })

  revalidatePath('/transport/portal')
  return { success: true }
}

/**
 * Mark a consolidation pickup as arrived at warehouse.
 * Only valid for transport_type='consolidation' with pickup status='picked_up'.
 */
export async function markArrivedAtWarehouse(bookingId: string) {
  const validatedId = z.string().uuid().parse(bookingId)
  const user = await requireTransport()

  const result = await withRLSContext(user, async (tx) => {
    // Fetch booking and linked pickup
    const [booking] = await tx
      .select({
        id: transportBookings.id,
        transport_type: transportBookings.transport_type,
        pickup_id: transportBookings.pickup_id,
        pickup_status: pickups.status,
      })
      .from(transportBookings)
      .innerJoin(pickups, eq(transportBookings.pickup_id, pickups.id))
      .where(eq(transportBookings.id, validatedId))
      .limit(1)

    if (!booking) return { error: 'Booking not found' }

    // Verify this is a consolidation booking
    if (booking.transport_type !== 'consolidation') {
      return { error: 'Only consolidation pickups can be marked as arrived at warehouse' }
    }

    // Verify pickup is in picked_up status
    if (booking.pickup_status !== 'picked_up') {
      return { error: 'Pickup must be in picked_up status' }
    }

    // Transition pickup to at_warehouse
    await tx
      .update(pickups)
      .set({ status: 'at_warehouse', updated_at: new Date() })
      .where(eq(pickups.id, booking.pickup_id))

    // Update booking updated_at
    await tx
      .update(transportBookings)
      .set({ updated_at: new Date() })
      .where(eq(transportBookings.id, validatedId))

    return { success: true }
  })

  if (result && 'error' in result) return result

  revalidatePath('/transport/portal')
  revalidatePath('/transport/outbound')
  return { success: true }
}

/**
 * Add or update delivery notes for a transport booking.
 */
export async function addDeliveryNotes(bookingId: string, notes: string) {
  const validatedId = z.string().uuid().parse(bookingId)
  const validatedNotes = z.string().max(2000).parse(notes)
  const user = await requireTransport()

  await withRLSContext(user, async (tx) => {
    await tx
      .update(transportBookings)
      .set({ delivery_notes: validatedNotes, updated_at: new Date() })
      .where(eq(transportBookings.id, validatedId))
  })

  revalidatePath('/transport/portal')
  return { success: true }
}

/**
 * Upload proof of delivery for a transport booking.
 * Stores file in the 'proof-of-delivery' Supabase Storage bucket.
 */
export async function uploadProofOfDelivery(bookingId: string, formData: FormData) {
  const validatedId = z.string().uuid().parse(bookingId)
  const user = await requireTransport()

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }

  // Validate file size: <= 10MB
  if (file.size > 10 * 1024 * 1024) {
    return { error: 'File size must be 10MB or less' }
  }

  // Validate file type: images and PDFs only
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return { error: 'File must be an image (JPEG, PNG, WebP) or PDF' }
  }

  const filename = `${validatedId}/${Date.now()}-${file.name}`
  const storagePath = `proof-of-delivery/${filename}`

  const storage = getStorageClient()
  const bucket = storage.from('proof-of-delivery')

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await bucket.upload(storagePath, arrayBuffer, {
    contentType: file.type,
  })

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` }
  }

  await withRLSContext(user, async (tx) => {
    await tx
      .update(transportBookings)
      .set({ proof_of_delivery_path: storagePath, updated_at: new Date() })
      .where(eq(transportBookings.id, validatedId))
  })

  revalidatePath('/transport/portal')
  return { success: true }
}
