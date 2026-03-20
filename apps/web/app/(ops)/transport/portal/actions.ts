'use server'

import { auth } from '@/auth'
import {
  db,
  transportBookings,
  transportProviders,
  pickups,
  locations,
  withRLSContext,
} from '@repo/db'
import { eq, and, gte } from 'drizzle-orm'
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
