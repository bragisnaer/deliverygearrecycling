'use server'

import { auth } from '@/auth'
import {
  db,
  pickups,
  pickupLines,
  products,
  locations,
  transportBookings,
  transportProviders,
  notifications,
  systemSettings,
  withRLSContext,
} from '@repo/db'
import { eq, and, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// --- Auth helpers ---

async function requireRecoAdminOrTransport() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  const role = session.user.role
  if (role !== 'reco-admin' && role !== 'transport') {
    throw new Error('Unauthorized: reco-admin or transport role required')
  }
  return {
    ...session.user,
    sub: session.user.id!,
  }
}

async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    throw new Error('Unauthorized: reco-admin role required')
  }
  return {
    ...session.user,
    sub: session.user.id!,
  }
}

// --- Server Actions ---

export async function getWarehouseInventory() {
  const user = await requireRecoAdminOrTransport()

  const heldPickups = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: pickups.id,
        reference: pickups.reference,
        status: pickups.status,
        pallet_count: pickups.pallet_count,
        updated_at: pickups.updated_at,
        location_name: locations.name,
        location_address: locations.address,
        location_country: locations.country,
        provider_name: transportProviders.name,
        provider_warehouse_address: transportProviders.warehouse_address,
        booking_id: transportBookings.id,
        confirmed_pickup_date: transportBookings.confirmed_pickup_date,
      })
      .from(pickups)
      .innerJoin(locations, eq(pickups.location_id, locations.id))
      .innerJoin(transportBookings, eq(transportBookings.pickup_id, pickups.id))
      .innerJoin(
        transportProviders,
        eq(transportProviders.id, transportBookings.transport_provider_id)
      )
      .where(eq(pickups.status, 'at_warehouse'))
      .orderBy(pickups.updated_at)
  })

  // Fetch pickup lines (product details) for each held pickup
  const pickupIds = heldPickups.map((p) => p.id)

  let linesByPickup: Record<string, Array<{ product_name: string; quantity: number }>> = {}

  if (pickupIds.length > 0) {
    const allLines = await withRLSContext(user, async (tx) => {
      return tx
        .select({
          pickup_id: pickupLines.pickup_id,
          product_name: products.name,
          quantity: pickupLines.quantity,
        })
        .from(pickupLines)
        .innerJoin(products, eq(pickupLines.product_id, products.id))
        .where(inArray(pickupLines.pickup_id, pickupIds))
    })

    const relevantLines = allLines
    for (const line of relevantLines) {
      if (!linesByPickup[line.pickup_id]) {
        linesByPickup[line.pickup_id] = []
      }
      linesByPickup[line.pickup_id].push({
        product_name: line.product_name,
        quantity: line.quantity,
      })
    }
  }

  // Fetch warehouse_ageing_threshold_days from system settings
  const settingsRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ warehouse_ageing_threshold_days: systemSettings.warehouse_ageing_threshold_days })
      .from(systemSettings)
      .limit(1)
  })

  const threshold = settingsRows[0]?.warehouse_ageing_threshold_days ?? 14

  const now = Date.now()
  const enrichedPickups = heldPickups.map((pickup) => {
    const days_held = Math.floor((now - pickup.updated_at.getTime()) / (1000 * 60 * 60 * 24))
    return {
      ...pickup,
      days_held,
      lines: linesByPickup[pickup.id] ?? [],
    }
  })

  return { pickups: enrichedPickups, threshold }
}

export async function checkAndCreateAgeingAlerts() {
  const user = await requireRecoAdmin()

  const { pickups: heldPickups, threshold } = await getWarehouseInventory()

  for (const pickup of heldPickups) {
    if (pickup.days_held > threshold) {
      // Check if an unread warehouse_ageing_alert notification already exists for this pickup
      const existing = await withRLSContext(user, async (tx) => {
        return tx
          .select({ id: notifications.id })
          .from(notifications)
          .where(
            and(
              eq(notifications.type, 'warehouse_ageing_alert'),
              eq(notifications.read, false),
              eq(notifications.entity_id, pickup.id)
            )
          )
          .limit(1)
      })

      if (existing.length === 0) {
        const warehouseName = pickup.provider_name ?? pickup.provider_warehouse_address ?? 'warehouse'
        await withRLSContext(user, async (tx) => {
          await tx.insert(notifications).values({
            user_id: null,
            tenant_id: null,
            type: 'warehouse_ageing_alert',
            title: `Warehouse ageing alert: ${pickup.reference}`,
            body: `Pickup ${pickup.reference} has been at ${warehouseName} for ${pickup.days_held} days (threshold: ${threshold})`,
            entity_type: 'pickup',
            entity_id: pickup.id,
            read: false,
          })
        })
      }
    }
  }
}

export async function updatePickupToAtWarehouse(pickupId: string) {
  const user = await requireRecoAdmin()

  // Validate pickup has a consolidation transport booking
  const bookings = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: transportBookings.id,
        transport_type: transportBookings.transport_type,
      })
      .from(transportBookings)
      .where(eq(transportBookings.pickup_id, pickupId))
      .limit(1)
  })

  if (bookings.length === 0) {
    return { error: 'No transport booking found for this pickup' }
  }

  if (bookings[0].transport_type !== 'consolidation') {
    return { error: 'Only consolidation pickups can be moved to at_warehouse status' }
  }

  await withRLSContext(user, async (tx) => {
    await tx
      .update(pickups)
      .set({ status: 'at_warehouse', updated_at: new Date() })
      .where(eq(pickups.id, pickupId))
  })

  revalidatePath('/transport/outbound')
  return { success: true }
}
