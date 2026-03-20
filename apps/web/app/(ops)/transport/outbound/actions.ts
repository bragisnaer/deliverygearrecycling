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
  prisonFacilities,
  notifications,
  systemSettings,
  outboundShipments,
  outboundShipmentPickups,
  withRLSContext,
} from '@repo/db'
import { eq, and, inArray, or, gte } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

// --- Pro-rata allocation ---

/**
 * Pure function: distributes totalCost across pickups proportionally by pallet count.
 * Rounding remainder is assigned to the last pickup so allocations sum exactly to totalCost.
 */
export function calculateProRataAllocation(
  totalCost: string,
  pickupAllocations: Array<{ pickupId: string; palletCount: number }>
): Array<{ pickupId: string; palletCount: number; allocatedCostEur: string }> {
  const total = parseFloat(totalCost)
  const totalPallets = pickupAllocations.reduce((sum, p) => sum + p.palletCount, 0)

  if (totalPallets === 0) {
    return pickupAllocations.map((p) => ({
      pickupId: p.pickupId,
      palletCount: p.palletCount,
      allocatedCostEur: (0).toFixed(4),
    }))
  }

  const results = pickupAllocations.map((p) => ({
    pickupId: p.pickupId,
    palletCount: p.palletCount,
    allocatedCostEur: ((p.palletCount / totalPallets) * total).toFixed(4),
  }))

  // Distribute rounding remainder to last item so allocations sum exactly to totalCost
  const sumAllocated = results.reduce((sum, r) => sum + parseFloat(r.allocatedCostEur), 0)
  const remainder = parseFloat((total - sumAllocated).toFixed(4))

  if (remainder !== 0 && results.length > 0) {
    const last = results[results.length - 1]
    last.allocatedCostEur = (parseFloat(last.allocatedCostEur) + remainder).toFixed(4)
  }

  return results
}

// --- Outbound Shipment Schema ---

const outboundShipmentSchema = z.object({
  prison_facility_id: z.string().uuid(),
  transport_provider_id: z.string().uuid(),
  transport_cost_warehouse_to_prison_eur: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a valid decimal number'),
  pickup_allocations: z
    .array(
      z.object({
        pickup_id: z.string().uuid(),
        pallet_count: z.number().int().min(1),
        allocated_cost_eur: z.string(),
      })
    )
    .min(1),
})

// --- Outbound Shipment Actions ---

export async function createOutboundShipment(formData: FormData) {
  const user = await requireRecoAdmin()

  const rawAllocations = formData.get('pickup_allocations')
  const parsedAllocations = rawAllocations ? JSON.parse(rawAllocations as string) : []

  const raw = {
    prison_facility_id: formData.get('prison_facility_id'),
    transport_provider_id: formData.get('transport_provider_id'),
    transport_cost_warehouse_to_prison_eur: formData.get(
      'transport_cost_warehouse_to_prison_eur'
    ),
    pickup_allocations: parsedAllocations,
  }

  const parsed = outboundShipmentSchema.parse(raw)

  // Validate: sum of allocated_cost_eur must equal transport_cost_warehouse_to_prison_eur
  const totalAllocated = parsed.pickup_allocations.reduce(
    (sum, a) => sum + parseFloat(a.allocated_cost_eur),
    0
  )
  const totalCost = parseFloat(parsed.transport_cost_warehouse_to_prison_eur)
  if (Math.abs(totalAllocated - totalCost) > 0.01) {
    return {
      error: `Allocated costs (${totalAllocated.toFixed(4)}) must equal total transport cost (${totalCost.toFixed(4)})`,
    }
  }

  const totalPalletCount = parsed.pickup_allocations.reduce(
    (sum, a) => sum + a.pallet_count,
    0
  )

  const pickupIds = parsed.pickup_allocations.map((a) => a.pickup_id)

  const inserted = await withRLSContext(user, async (tx) => {
    // INSERT outbound_shipments row
    const [shipment] = await tx
      .insert(outboundShipments)
      .values({
        transport_provider_id: parsed.transport_provider_id,
        prison_facility_id: parsed.prison_facility_id,
        transport_cost_warehouse_to_prison_eur:
          parsed.transport_cost_warehouse_to_prison_eur,
        total_pallet_count: totalPalletCount,
        status: 'created',
        created_by: user.id ?? null,
      })
      .returning({ id: outboundShipments.id })

    // INSERT outbound_shipment_pickups rows
    await tx.insert(outboundShipmentPickups).values(
      parsed.pickup_allocations.map((a) => ({
        outbound_shipment_id: shipment.id,
        pickup_id: a.pickup_id,
        pallet_count: a.pallet_count,
        allocated_cost_eur: a.allocated_cost_eur,
      }))
    )

    // UPDATE all selected pickups status to 'in_outbound_shipment'
    await tx
      .update(pickups)
      .set({ status: 'in_outbound_shipment', updated_at: new Date() })
      .where(inArray(pickups.id, pickupIds))

    return shipment
  })

  revalidatePath('/transport/outbound')
  return { success: true, shipmentId: inserted.id }
}

export async function markOutboundInTransit(shipmentId: string) {
  const user = await requireRecoAdminOrTransport()

  const validatedId = z.string().uuid().parse(shipmentId)

  await withRLSContext(user, async (tx) => {
    await tx
      .update(outboundShipments)
      .set({ status: 'in_transit', dispatched_at: new Date(), updated_at: new Date() })
      .where(eq(outboundShipments.id, validatedId))
  })

  // Cascade to linked pickups: in_transit
  const pickupRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ pickup_id: outboundShipmentPickups.pickup_id })
      .from(outboundShipmentPickups)
      .where(eq(outboundShipmentPickups.outbound_shipment_id, validatedId))
  })

  const pickupIds = pickupRows.map((r) => r.pickup_id)

  if (pickupIds.length > 0) {
    await withRLSContext(user, async (tx) => {
      await tx
        .update(pickups)
        .set({ status: 'in_transit', updated_at: new Date() })
        .where(inArray(pickups.id, pickupIds))
    })
  }

  revalidatePath('/transport/outbound')
  return { success: true }
}

export async function markOutboundDelivered(shipmentId: string) {
  const user = await requireRecoAdminOrTransport()

  const validatedId = z.string().uuid().parse(shipmentId)

  // UPDATE outbound_shipments SET status='delivered'
  await withRLSContext(user, async (tx) => {
    await tx
      .update(outboundShipments)
      .set({ status: 'delivered', delivered_at: new Date(), updated_at: new Date() })
      .where(eq(outboundShipments.id, validatedId))
  })

  // SELECT all pickup_ids from outbound_shipment_pickups
  const pickupRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ pickup_id: outboundShipmentPickups.pickup_id })
      .from(outboundShipmentPickups)
      .where(eq(outboundShipmentPickups.outbound_shipment_id, validatedId))
  })

  const pickupIds = pickupRows.map((r) => r.pickup_id)

  if (pickupIds.length > 0) {
    // UPDATE pickups SET status='delivered'
    await withRLSContext(user, async (tx) => {
      await tx
        .update(pickups)
        .set({ status: 'delivered', updated_at: new Date() })
        .where(inArray(pickups.id, pickupIds))
    })
  }

  revalidatePath('/transport/outbound')
  return { success: true }
}

// --- Outbound Shipment List ---

export async function getOutboundShipments() {
  const user = await requireRecoAdminOrTransport()

  // Active shipments: status IN ('created', 'in_transit')
  const activeShipments = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: outboundShipments.id,
        status: outboundShipments.status,
        total_pallet_count: outboundShipments.total_pallet_count,
        transport_cost_warehouse_to_prison_eur:
          outboundShipments.transport_cost_warehouse_to_prison_eur,
        created_at: outboundShipments.created_at,
        dispatched_at: outboundShipments.dispatched_at,
        delivered_at: outboundShipments.delivered_at,
        provider_name: transportProviders.name,
        prison_name: prisonFacilities.name,
      })
      .from(outboundShipments)
      .innerJoin(
        transportProviders,
        eq(transportProviders.id, outboundShipments.transport_provider_id)
      )
      .innerJoin(
        prisonFacilities,
        eq(prisonFacilities.id, outboundShipments.prison_facility_id)
      )
      .where(or(eq(outboundShipments.status, 'created'), eq(outboundShipments.status, 'in_transit')))
      .orderBy(outboundShipments.created_at)
  })

  // Completed shipments: status='delivered' in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const completedShipments = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: outboundShipments.id,
        status: outboundShipments.status,
        total_pallet_count: outboundShipments.total_pallet_count,
        transport_cost_warehouse_to_prison_eur:
          outboundShipments.transport_cost_warehouse_to_prison_eur,
        created_at: outboundShipments.created_at,
        dispatched_at: outboundShipments.dispatched_at,
        delivered_at: outboundShipments.delivered_at,
        provider_name: transportProviders.name,
        prison_name: prisonFacilities.name,
      })
      .from(outboundShipments)
      .innerJoin(
        transportProviders,
        eq(transportProviders.id, outboundShipments.transport_provider_id)
      )
      .innerJoin(
        prisonFacilities,
        eq(prisonFacilities.id, outboundShipments.prison_facility_id)
      )
      .where(
        and(
          eq(outboundShipments.status, 'delivered'),
          gte(outboundShipments.delivered_at, thirtyDaysAgo)
        )
      )
      .orderBy(outboundShipments.delivered_at)
  })

  return { activeShipments, completedShipments }
}
