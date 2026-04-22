'use server'

import { auth } from '@/auth'
import {
  db,
  pickups,
  pickupLines,
  locations,
  products,
  transportBookings,
  transportProviders,
  prisonFacilities,
  outboundShipmentPickups,
  outboundShipments,
  withRLSContext,
} from '@repo/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { dispatchNotification } from '@/lib/notification-events'
import PickupConfirmedEmail from '@/emails/pickup-confirmed'

// --- Auth helpers ---

async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    throw new Error('Unauthorized: reco-admin role required')
  }
  const user = session.user
  return {
    ...user,
    // JWTClaims requires sub — next-auth stores the user id as session.user.id (= token.sub)
    sub: user.id!,
  }
}

// Terminal statuses that cannot be cancelled
const TERMINAL_STATUSES = ['delivered', 'intake_registered', 'cancelled'] as const

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  submitted: ['confirmed', 'cancelled'],
  confirmed: ['transport_booked', 'cancelled'],
  transport_booked: ['picked_up', 'cancelled'],
  picked_up: ['at_warehouse'],
  at_warehouse: ['in_outbound_shipment'],
  in_outbound_shipment: ['in_transit'],
  in_transit: ['delivered'],
  delivered: ['intake_registered'],
  intake_registered: [],
  cancelled: [],
}

// --- Server Actions ---

export async function confirmPickup(pickupId: string) {
  const user = await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(pickupId)

  // Fetch pickup and validate status
  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: pickups.id, status: pickups.status })
      .from(pickups)
      .where(eq(pickups.id, validatedId))
      .limit(1)
  })

  const pickup = rows[0]
  if (!pickup) {
    return { error: 'Pickup not found' }
  }

  if (pickup.status !== 'submitted') {
    return { error: 'Can only confirm pickups with submitted status' }
  }

  // Fetch pickup details for notification
  const pickupDetail = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        reference: pickups.reference,
        tenant_id: pickups.tenant_id,
        submitted_by: pickups.submitted_by,
        location_name: locations.name,
        confirmed_date: pickups.confirmed_date,
      })
      .from(pickups)
      .leftJoin(locations, eq(pickups.location_id, locations.id))
      .where(eq(pickups.id, validatedId))
      .limit(1)
  })

  const pickupInfo = pickupDetail[0]

  // Update status to confirmed
  const confirmedDate = new Date()
  await withRLSContext(user, async (tx) => {
    return tx
      .update(pickups)
      .set({
        status: 'confirmed',
        confirmed_date: confirmedDate,
        updated_at: new Date(),
      })
      .where(eq(pickups.id, validatedId))
  })

  // Send pickup_confirmed notification + email (non-blocking)
  if (pickupInfo) {
    try {
      // Fetch the client user email for email notification
      const { db: rawDb, users } = await import('@repo/db')
      const clientUser = pickupInfo.submitted_by
        ? await rawDb
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, pickupInfo.submitted_by as string))
            .limit(1)
        : []
      const clientEmail = clientUser[0]?.email

      await dispatchNotification({
        userId: pickupInfo.submitted_by as string | null,
        tenantId: pickupInfo.tenant_id,
        type: 'pickup_confirmed',
        title: `Pickup ${pickupInfo.reference} confirmed`,
        body: `Your pickup request has been confirmed for ${confirmedDate.toISOString().split('T')[0]}.`,
        entityType: 'pickup',
        entityId: validatedId,
        email: clientEmail ? {
          to: clientEmail,
          subject: `Pickup ${pickupInfo.reference} Confirmed`,
          react: PickupConfirmedEmail({
            reference: pickupInfo.reference,
            clientName: pickupInfo.location_name ?? 'Client',
            locationName: pickupInfo.location_name ?? 'Your location',
            confirmedDate: confirmedDate.toISOString().split('T')[0],
            pickupId: validatedId,
          }),
        } : undefined,
      })
    } catch (err) {
      console.error('[notification] Pickup confirmation failed:', err)
    }
  }

  revalidatePath('/ops-pickups')
  return { success: true }
}

export async function cancelPickup(pickupId: string, reason: string) {
  const user = await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(pickupId)

  // Validate reason is non-empty
  if (!reason || reason.trim() === '') {
    return { error: 'Cancellation reason is required' }
  }

  // Fetch pickup and validate status
  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: pickups.id, status: pickups.status })
      .from(pickups)
      .where(eq(pickups.id, validatedId))
      .limit(1)
  })

  const pickup = rows[0]
  if (!pickup) {
    return { error: 'Pickup not found' }
  }

  if ((TERMINAL_STATUSES as readonly string[]).includes(pickup.status)) {
    return { error: 'Cannot cancel a pickup in terminal status' }
  }

  // Update to cancelled
  await withRLSContext(user, async (tx) => {
    return tx
      .update(pickups)
      .set({
        status: 'cancelled',
        cancellation_reason: reason.trim(),
        cancelled_at: new Date(),
        cancelled_by: user.sub as unknown as string,
        updated_at: new Date(),
      })
      .where(eq(pickups.id, validatedId))
  })

  revalidatePath('/ops-pickups')
  return { success: true }
}

export async function updatePickupStatus(pickupId: string, newStatus: string) {
  const user = await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(pickupId)

  // Fetch pickup
  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: pickups.id, status: pickups.status })
      .from(pickups)
      .where(eq(pickups.id, validatedId))
      .limit(1)
  })

  const pickup = rows[0]
  if (!pickup) {
    return { error: 'Pickup not found' }
  }

  // Validate transition
  const allowedNext = STATUS_TRANSITIONS[pickup.status] ?? []
  if (!allowedNext.includes(newStatus)) {
    return {
      error: `Cannot transition from '${pickup.status}' to '${newStatus}'`,
    }
  }

  // Fetch pickup info for notification (before update)
  const pickupRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        reference: pickups.reference,
        tenant_id: pickups.tenant_id,
        location_name: locations.name,
      })
      .from(pickups)
      .leftJoin(locations, eq(pickups.location_id, locations.id))
      .where(eq(pickups.id, validatedId))
      .limit(1)
  })

  const pickupRef = pickupRows[0]

  // Update status
  await withRLSContext(user, async (tx) => {
    return tx
      .update(pickups)
      .set({
        status: newStatus as typeof pickups.status._.data,
        updated_at: new Date(),
      })
      .where(eq(pickups.id, validatedId))
  })

  // Fire pickup_collected notification when status transitions to picked_up
  if (newStatus === 'picked_up' && pickupRef) {
    try {
      await dispatchNotification({
        userId: null,
        tenantId: pickupRef.tenant_id,
        type: 'pickup_collected',
        title: `Pickup ${pickupRef.reference} collected`,
        body: `Pickup from ${pickupRef.location_name ?? 'location'} has been collected.`,
        entityType: 'pickup',
        entityId: validatedId,
      })
    } catch (err) {
      console.error('[notification] pickup_collected failed:', err)
    }
  }

  revalidatePath('/ops-pickups')
  return { success: true }
}

// --- Read actions (used by queue page and detail page) ---

export async function getPickupQueue(status?: string) {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    const query = tx
      .select({
        id: pickups.id,
        reference: pickups.reference,
        status: pickups.status,
        pallet_count: pickups.pallet_count,
        preferred_date: pickups.preferred_date,
        confirmed_date: pickups.confirmed_date,
        created_at: pickups.created_at,
        is_imported: pickups.is_imported,
        location_name: locations.name,
        location_address: locations.address,
      })
      .from(pickups)
      .leftJoin(locations, eq(pickups.location_id, locations.id))
      .orderBy(pickups.created_at)

    if (status) {
      return query.where(eq(pickups.status, status as typeof pickups.status._.data))
    }

    return query
  })
}

// --- Transport booking schemas ---

const directTransportSchema = z.object({
  pickup_id: z.string().uuid(),
  transport_provider_id: z.string().uuid(),
  prison_facility_id: z.string().uuid(),
  transport_cost_market_to_destination_eur: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Invalid cost format'),
  confirmed_pickup_date: z.string().transform((v) => new Date(v)),
})

const consolidationTransportSchema = z.object({
  pickup_id: z.string().uuid(),
  transport_provider_id: z.string().uuid(),
  transport_cost_market_to_destination_eur: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Invalid cost format'),
  confirmed_pickup_date: z.string().transform((v) => new Date(v)),
})

export async function bookDirectTransport(formData: FormData) {
  const user = await requireRecoAdmin()

  const raw = {
    pickup_id: formData.get('pickup_id'),
    transport_provider_id: formData.get('transport_provider_id'),
    prison_facility_id: formData.get('prison_facility_id'),
    transport_cost_market_to_destination_eur: formData.get(
      'transport_cost_market_to_destination_eur'
    ),
    confirmed_pickup_date: formData.get('confirmed_pickup_date'),
  }

  const parsed = directTransportSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }
  }

  const data = parsed.data

  // Validate pickup status is 'confirmed'
  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: pickups.id, status: pickups.status })
      .from(pickups)
      .where(eq(pickups.id, data.pickup_id))
      .limit(1)
  })

  const pickup = rows[0]
  if (!pickup) {
    return { error: 'Pickup not found' }
  }

  if (pickup.status !== 'confirmed') {
    return { error: 'Can only book transport on a confirmed pickup' }
  }

  // Insert transport booking
  await withRLSContext(user, async (tx) => {
    return tx.insert(transportBookings).values({
      pickup_id: data.pickup_id,
      transport_provider_id: data.transport_provider_id,
      transport_type: 'direct',
      prison_facility_id: data.prison_facility_id,
      transport_cost_market_to_destination_eur:
        data.transport_cost_market_to_destination_eur,
      confirmed_pickup_date: data.confirmed_pickup_date,
      booked_by: user.id as unknown as string,
    })
  })

  // Update pickup status to transport_booked
  await withRLSContext(user, async (tx) => {
    return tx
      .update(pickups)
      .set({
        status: 'transport_booked',
        confirmed_date: data.confirmed_pickup_date,
        updated_at: new Date(),
      })
      .where(eq(pickups.id, data.pickup_id))
  })

  revalidatePath('/ops-pickups')
  return { success: true }
}

export async function bookConsolidationTransport(formData: FormData) {
  const user = await requireRecoAdmin()

  const raw = {
    pickup_id: formData.get('pickup_id'),
    transport_provider_id: formData.get('transport_provider_id'),
    transport_cost_market_to_destination_eur: formData.get(
      'transport_cost_market_to_destination_eur'
    ),
    confirmed_pickup_date: formData.get('confirmed_pickup_date'),
  }

  const parsed = consolidationTransportSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Invalid input' }
  }

  const data = parsed.data

  // Validate pickup status is 'confirmed'
  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: pickups.id, status: pickups.status })
      .from(pickups)
      .where(eq(pickups.id, data.pickup_id))
      .limit(1)
  })

  const pickup = rows[0]
  if (!pickup) {
    return { error: 'Pickup not found' }
  }

  if (pickup.status !== 'confirmed') {
    return { error: 'Can only book transport on a confirmed pickup' }
  }

  // Insert transport booking (prison_facility_id is null — destination is warehouse)
  await withRLSContext(user, async (tx) => {
    return tx.insert(transportBookings).values({
      pickup_id: data.pickup_id,
      transport_provider_id: data.transport_provider_id,
      transport_type: 'consolidation',
      prison_facility_id: null,
      transport_cost_market_to_destination_eur:
        data.transport_cost_market_to_destination_eur,
      confirmed_pickup_date: data.confirmed_pickup_date,
      booked_by: user.id as unknown as string,
    })
  })

  // Update pickup status to transport_booked
  await withRLSContext(user, async (tx) => {
    return tx
      .update(pickups)
      .set({
        status: 'transport_booked',
        confirmed_date: data.confirmed_pickup_date,
        updated_at: new Date(),
      })
      .where(eq(pickups.id, data.pickup_id))
  })

  revalidatePath('/ops-pickups')
  return { success: true }
}

export async function getPickupDetail(pickupId: string) {
  const user = await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(pickupId)

  const rows = await withRLSContext(user, async (tx) => {
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
        cancelled_at: pickups.cancelled_at,
        created_at: pickups.created_at,
        updated_at: pickups.updated_at,
        location_name: locations.name,
        location_address: locations.address,
      })
      .from(pickups)
      .leftJoin(locations, eq(pickups.location_id, locations.id))
      .where(eq(pickups.id, validatedId))
      .limit(1)
  })

  const pickup = rows[0]
  if (!pickup) return null

  // Fetch pickup lines with product info
  const lines = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: pickupLines.id,
        quantity: pickupLines.quantity,
        product_id: pickupLines.product_id,
        product_name: products.name,
        product_code: products.product_code,
      })
      .from(pickupLines)
      .leftJoin(products, eq(pickupLines.product_id, products.id))
      .where(eq(pickupLines.pickup_id, validatedId))
  })

  // Fetch transport booking with provider and prison facility details
  const bookingRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: transportBookings.id,
        transport_type: transportBookings.transport_type,
        transport_cost_market_to_destination_eur:
          transportBookings.transport_cost_market_to_destination_eur,
        confirmed_pickup_date: transportBookings.confirmed_pickup_date,
        delivery_notes: transportBookings.delivery_notes,
        proof_of_delivery_path: transportBookings.proof_of_delivery_path,
        provider_id: transportProviders.id,
        provider_name: transportProviders.name,
        provider_warehouse_address: transportProviders.warehouse_address,
        prison_facility_id: prisonFacilities.id,
        prison_facility_name: prisonFacilities.name,
        prison_facility_address: prisonFacilities.address,
      })
      .from(transportBookings)
      .innerJoin(
        transportProviders,
        eq(transportProviders.id, transportBookings.transport_provider_id)
      )
      .leftJoin(
        prisonFacilities,
        eq(prisonFacilities.id, transportBookings.prison_facility_id)
      )
      .where(eq(transportBookings.pickup_id, validatedId))
      .limit(1)
  })

  const booking = bookingRows[0] ?? null

  // Fetch outbound shipment allocation if pickup is in one
  let outboundAllocation: {
    shipment_id: string
    allocated_cost_eur: string | null
    shipment_status: string
  } | null = null

  if (booking) {
    const allocationRows = await withRLSContext(user, async (tx) => {
      return tx
        .select({
          shipment_id: outboundShipmentPickups.outbound_shipment_id,
          allocated_cost_eur: outboundShipmentPickups.allocated_cost_eur,
          shipment_status: outboundShipments.status,
        })
        .from(outboundShipmentPickups)
        .innerJoin(
          outboundShipments,
          eq(outboundShipments.id, outboundShipmentPickups.outbound_shipment_id)
        )
        .where(eq(outboundShipmentPickups.pickup_id, validatedId))
        .limit(1)
    })

    outboundAllocation = allocationRows[0] ?? null
  }

  return { ...pickup, lines, booking, outboundAllocation }
}
