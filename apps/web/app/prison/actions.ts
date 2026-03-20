'use server'

import { auth } from '@/auth'
import {
  pickups,
  pickupLines,
  locations,
  products,
  tenants,
  transportBookings,
  outboundShipmentPickups,
  outboundShipments,
  intakeRecords,
  withRLSContext,
} from '@repo/db'
import { eq, and, isNull } from 'drizzle-orm'

// --- Types ---

export type ExpectedDelivery = {
  pickup_id: string
  reference: string
  client_name: string
  tenant_id: string
  origin_market: string
  expected_date: string
  transport_type: 'direct' | 'consolidation'
  outbound_shipment_id?: string
  outbound_shipment_reference?: string
  lines: { product_id: string; product_name: string; quantity: number }[]
}

export type DeliveryGroup =
  | {
      type: 'direct'
      delivery: ExpectedDelivery
    }
  | {
      type: 'consolidated'
      outbound_shipment_id: string
      outbound_shipment_reference: string
      deliveries: ExpectedDelivery[]
    }

// --- Auth helpers ---

async function requirePrisonSession() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'prison') {
    throw new Error('Unauthorized: prison role required')
  }
  const user = session.user
  return {
    ...user,
    // JWTClaims requires sub — next-auth stores the user id as session.user.id (= token.sub)
    sub: user.id!,
  }
}

// --- Server Actions ---

/**
 * Returns expected deliveries for the current prison facility.
 * Fetches pickups with status 'delivered' that:
 *   - have a transport_booking pointing to this facility (direct), or
 *   - are part of an outbound_shipment pointing to this facility (consolidation)
 *   - have no existing intake_record (i.e., not yet registered)
 *
 * Returns grouped: direct deliveries as individual items,
 * consolidated deliveries grouped by outbound_shipment_id.
 */
export async function getExpectedDeliveries(): Promise<DeliveryGroup[]> {
  const user = await requirePrisonSession()

  const facilityId = user.facility_id
  if (!facilityId) {
    throw new Error('Prison session missing facility_id')
  }

  // Query pickups with status 'delivered', transport booking targeting this facility,
  // and no existing intake record
  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        pickup_id: pickups.id,
        reference: pickups.reference,
        tenant_id: pickups.tenant_id,
        preferred_date: pickups.preferred_date,
        confirmed_date: pickups.confirmed_date,
        location_country: locations.country,
        location_name: locations.name,
        client_name: tenants.name,
        transport_type: transportBookings.transport_type,
        transport_prison_facility_id: transportBookings.prison_facility_id,
        outbound_shipment_id: outboundShipmentPickups.outbound_shipment_id,
        outbound_prison_facility_id: outboundShipments.prison_facility_id,
      })
      .from(pickups)
      .innerJoin(transportBookings, eq(transportBookings.pickup_id, pickups.id))
      .innerJoin(locations, eq(locations.id, pickups.location_id))
      .innerJoin(tenants, eq(tenants.id, pickups.tenant_id))
      .leftJoin(
        outboundShipmentPickups,
        eq(outboundShipmentPickups.pickup_id, pickups.id)
      )
      .leftJoin(
        outboundShipments,
        eq(outboundShipments.id, outboundShipmentPickups.outbound_shipment_id)
      )
      .leftJoin(
        intakeRecords,
        eq(intakeRecords.pickup_id, pickups.id)
      )
      .where(
        and(
          eq(pickups.status, 'delivered'),
          isNull(intakeRecords.id)
        )
      )
  })

  if (rows.length === 0) {
    return []
  }

  // Fetch pickup IDs to retrieve lines in a second query
  const pickupIds = [...new Set(rows.map((r) => r.pickup_id))]

  // Fetch all pickup lines for these pickups in one query
  const allLines = await withRLSContext(user, async (tx) => {
    const results: {
      pickup_id: string
      product_id: string
      product_name: string | null
      quantity: number
    }[] = []

    for (const pid of pickupIds) {
      const lineRows = await tx
        .select({
          pickup_id: pickupLines.pickup_id,
          product_id: pickupLines.product_id,
          product_name: products.name,
          quantity: pickupLines.quantity,
        })
        .from(pickupLines)
        .leftJoin(products, eq(products.id, pickupLines.product_id))
        .where(eq(pickupLines.pickup_id, pid))

      results.push(...lineRows)
    }

    return results
  })

  // Group lines by pickup_id for fast lookup
  const linesByPickupId = new Map<
    string,
    { product_id: string; product_name: string; quantity: number }[]
  >()
  for (const line of allLines) {
    const existing = linesByPickupId.get(line.pickup_id) ?? []
    existing.push({
      product_id: line.product_id,
      product_name: line.product_name ?? 'Unknown product',
      quantity: line.quantity,
    })
    linesByPickupId.set(line.pickup_id, existing)
  }

  // Build ExpectedDelivery objects
  const deliveries: ExpectedDelivery[] = rows.map((row) => ({
    pickup_id: row.pickup_id,
    reference: row.reference,
    client_name: row.client_name,
    tenant_id: row.tenant_id,
    origin_market: `${row.location_name} (${row.location_country})`,
    expected_date: (
      row.confirmed_date ?? row.preferred_date
    ).toISOString().split('T')[0]!,
    transport_type: row.transport_type,
    outbound_shipment_id: row.outbound_shipment_id ?? undefined,
    // outbound_shipments has no reference column — derive a display reference from id prefix
    outbound_shipment_reference: row.outbound_shipment_id
      ? `OS-${row.outbound_shipment_id.slice(0, 8).toUpperCase()}`
      : undefined,
    lines: linesByPickupId.get(row.pickup_id) ?? [],
  }))

  // Group: direct as individual, consolidated grouped by outbound_shipment_id
  const groups: DeliveryGroup[] = []
  const consolidatedMap = new Map<string, ExpectedDelivery[]>()
  const consolidatedRefMap = new Map<string, string>()

  for (const delivery of deliveries) {
    if (
      delivery.transport_type === 'direct' ||
      !delivery.outbound_shipment_id
    ) {
      groups.push({ type: 'direct', delivery })
    } else {
      const shipmentId = delivery.outbound_shipment_id
      const existing = consolidatedMap.get(shipmentId) ?? []
      existing.push(delivery)
      consolidatedMap.set(shipmentId, existing)
      if (delivery.outbound_shipment_reference) {
        consolidatedRefMap.set(shipmentId, delivery.outbound_shipment_reference)
      }
    }
  }

  for (const [shipmentId, shipmentDeliveries] of consolidatedMap.entries()) {
    groups.push({
      type: 'consolidated',
      outbound_shipment_id: shipmentId,
      outbound_shipment_reference:
        consolidatedRefMap.get(shipmentId) ?? shipmentId,
      deliveries: shipmentDeliveries,
    })
  }

  return groups
}
