'use server'

import { auth } from '@/auth'
import {
  db,
  pickups,
  pickupLines,
  locations,
  products,
  tenants,
  transportBookings,
  outboundShipmentPickups,
  outboundShipments,
  intakeRecords,
  intakeLines,
  notifications,
  systemSettings,
  withRLSContext,
} from '@repo/db'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { calculateDiscrepancyPct } from '@/lib/discrepancy'

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

// --- Expected Delivery Detail (single pickup) ---

export type ExpectedDeliveryDetail = {
  pickup_id: string
  reference: string
  client_name: string
  tenant_id: string
  origin_market: string
  lines: {
    product_id: string
    product_name: string
    informed_quantity: number
  }[]
}

/**
 * Fetches a single pickup by ID with its lines and products.
 * Used to pre-populate the intake form for an expected delivery.
 */
export async function getExpectedDelivery(
  pickupId: string
): Promise<ExpectedDeliveryDetail | null> {
  const user = await requirePrisonSession()

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        pickup_id: pickups.id,
        reference: pickups.reference,
        tenant_id: pickups.tenant_id,
        client_name: tenants.name,
        location_country: locations.country,
        location_name: locations.name,
      })
      .from(pickups)
      .innerJoin(tenants, eq(tenants.id, pickups.tenant_id))
      .innerJoin(locations, eq(locations.id, pickups.location_id))
      .where(eq(pickups.id, pickupId))
      .limit(1)
  })

  if (rows.length === 0) return null

  const row = rows[0]!

  const lineRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        product_id: pickupLines.product_id,
        product_name: products.name,
        quantity: pickupLines.quantity,
      })
      .from(pickupLines)
      .leftJoin(products, eq(products.id, pickupLines.product_id))
      .where(eq(pickupLines.pickup_id, pickupId))
  })

  return {
    pickup_id: row.pickup_id,
    reference: row.reference,
    client_name: row.client_name,
    tenant_id: row.tenant_id,
    origin_market: `${row.location_name} (${row.location_country})`,
    lines: lineRows.map((l) => ({
      product_id: l.product_id,
      product_name: l.product_name ?? 'Unknown product',
      informed_quantity: l.quantity,
    })),
  }
}

// --- Submit Intake ---

const intakeLineSchema = z.object({
  product_id: z.string().uuid(),
  actual_quantity: z.coerce.number().int().min(0),
  informed_quantity: z.coerce.number().int().min(0).optional(),
  batch_lot_number: z.string().optional(),
})

const submitIntakeSchema = z.object({
  pickup_id: z.string().uuid().optional(),
  staff_name: z.string().min(1, 'staff_name is required'),
  delivery_date: z.string().min(1, 'delivery_date is required'),
  origin_market: z.string().optional(),
  notes: z.string().optional(),
  lines: z
    .array(intakeLineSchema)
    .min(1, 'At least one product line is required'),
})

/**
 * Submits an intake form: validates, calculates discrepancies, inserts
 * intake_record + intake_lines, notifies reco-admin if discrepancies found,
 * and updates pickup status to 'intake_registered'.
 */
export async function submitIntake(
  formData: FormData
): Promise<{ success: true; intakeId: string } | { error: string }> {
  const user = await requirePrisonSession()

  const facilityId = user.facility_id
  if (!facilityId) {
    return { error: 'Prison session missing facility_id' }
  }

  // Parse indexed lines from FormData: lines[N][field]
  const linesMap = new Map<
    number,
    {
      product_id?: string
      actual_quantity?: string
      informed_quantity?: string
      batch_lot_number?: string
    }
  >()

  for (const [key, value] of formData.entries()) {
    const match = key.match(/^lines\[(\d+)\]\[(\w+)\]$/)
    if (match) {
      const idx = parseInt(match[1]!, 10)
      const field = match[2]!
      const existing = linesMap.get(idx) ?? {}
      linesMap.set(idx, { ...existing, [field]: value as string })
    }
  }

  const rawLines = Array.from(linesMap.values())

  const rawInput = {
    pickup_id: formData.get('pickup_id') as string | undefined,
    staff_name: formData.get('staff_name') as string,
    delivery_date: formData.get('delivery_date') as string,
    origin_market: formData.get('origin_market') as string | undefined,
    notes: formData.get('notes') as string | undefined,
    lines: rawLines,
  }

  const parsed = submitIntakeSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Validation failed' }
  }

  const input = parsed.data

  // Read discrepancy threshold from system_settings (default 15)
  let threshold = 15
  try {
    const settings = await db.select().from(systemSettings).limit(1)
    if (settings.length > 0 && settings[0]) {
      threshold = settings[0].discrepancy_alert_threshold_pct
    }
  } catch {
    // Non-critical — fall back to default 15
  }

  // Calculate discrepancy per line
  const processedLines = input.lines.map((line) => {
    const pct = calculateDiscrepancyPct(
      line.actual_quantity,
      line.informed_quantity ?? null
    )
    return {
      ...line,
      discrepancy_pct: pct,
    }
  })

  const discrepancy_flagged = processedLines.some(
    (l) => l.discrepancy_pct !== null && l.discrepancy_pct > threshold
  )

  // Insert intake_record + intake_lines in a single withRLSContext transaction
  let intakeId: string

  try {
    const result = await withRLSContext(user, async (tx) => {
      const [record] = await tx
        .insert(intakeRecords)
        .values({
          prison_facility_id: facilityId,
          pickup_id: input.pickup_id ?? null,
          tenant_id: user.tenant_id!,
          staff_name: input.staff_name,
          delivery_date: new Date(input.delivery_date),
          origin_market: input.origin_market ?? null,
          is_unexpected: !input.pickup_id,
          discrepancy_flagged,
          submitted_by: user.id ?? null,
        })
        .returning({ id: intakeRecords.id, reference: intakeRecords.reference })

      if (!record) throw new Error('Failed to insert intake record')

      await tx.insert(intakeLines).values(
        processedLines.map((line) => ({
          intake_record_id: record.id,
          product_id: line.product_id,
          informed_quantity: line.informed_quantity ?? null,
          actual_quantity: line.actual_quantity,
          batch_lot_number: line.batch_lot_number ?? null,
          discrepancy_pct: line.discrepancy_pct !== null
            ? line.discrepancy_pct.toFixed(2)
            : null,
        }))
      )

      // Update pickup status to 'intake_registered'
      if (input.pickup_id) {
        await tx
          .update(pickups)
          .set({ status: 'intake_registered', updated_at: new Date() })
          .where(eq(pickups.id, input.pickup_id))
      }

      return record
    })

    intakeId = result.id

    // Insert discrepancy notification for reco-admin (non-blocking)
    if (discrepancy_flagged) {
      try {
        await withRLSContext(user, async (tx) => {
          return tx.insert(notifications).values({
            type: 'discrepancy_detected',
            title: `Discrepancy detected in intake`,
            body: `Intake at facility ${facilityId} has discrepancies exceeding ${threshold}%.`,
            entity_type: 'intake_record',
            entity_id: intakeId,
          })
        })
      } catch {
        // Non-blocking — notification failure must not break intake submission
      }
    }
  } catch (err) {
    console.error('submitIntake error:', err)
    return { error: 'Failed to submit intake' }
  }

  return { success: true, intakeId }
}
