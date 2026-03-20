'use server'

import { auth } from '@/auth'
import {
  db,
  withRLSContext,
  outboundDispatches,
  outboundDispatchLines,
  products,
  prisonFacilities,
  tenants,
} from '@repo/db'
import { eq, and, inArray, desc, count } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// Dispatch status lifecycle: created → picked_up → delivered
// Exported for testability
export const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ['picked_up'],
  picked_up: ['delivered'],
  delivered: [],
}

// --- Auth helpers ---

async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    throw new Error('Unauthorized: reco-admin role required')
  }
  const user = session.user
  return {
    ...user,
    sub: user.id!,
  }
}

// --- Types ---

export type CreateDispatchInput = {
  prison_facility_id: string
  tenant_id: string
  intake_record_id?: string // Optional — for deterministic traceability linkage (PROCESS-05)
  dispatch_date: Date
  destination: string
  carrier?: string
  notes?: string
  lines: Array<{
    product_id: string
    size_bucket?: string
    sku_code?: string
    quantity: number
  }>
}

export type DispatchRecord = {
  id: string
  prison_facility_id: string
  tenant_id: string
  intake_record_id: string | null
  dispatch_date: Date
  destination: string
  carrier: string | null
  notes: string | null
  status: string
  voided: boolean
  created_at: Date
  updated_at: Date
}

// --- Server Actions ---

/**
 * Create an outbound dispatch record with packing list lines.
 * reco-admin only (DISPATCH-01).
 * Optional intake_record_id enables deterministic traceability chain linking (PROCESS-05).
 */
export async function createDispatch(
  input: CreateDispatchInput
): Promise<{ success: true; id: string } | { error: string }> {
  const user = await requireRecoAdmin()

  const rows = await withRLSContext(user, async (tx) => {
    const [dispatch] = await tx
      .insert(outboundDispatches)
      .values({
        prison_facility_id: input.prison_facility_id,
        tenant_id: input.tenant_id,
        intake_record_id: input.intake_record_id ?? null,
        dispatch_date: input.dispatch_date,
        destination: input.destination,
        carrier: input.carrier ?? null,
        notes: input.notes ?? null,
        created_by: user.id as unknown as string,
      })
      .returning()

    if (dispatch && input.lines.length > 0) {
      await tx.insert(outboundDispatchLines).values(
        input.lines.map((line) => ({
          outbound_dispatch_id: dispatch.id,
          product_id: line.product_id,
          size_bucket: (line.size_bucket ?? null) as never,
          sku_code: line.sku_code ?? null,
          quantity: line.quantity,
        }))
      )
    }

    return [dispatch]
  })

  const dispatch = rows[0]
  if (!dispatch) {
    return { error: 'Failed to create dispatch' }
  }

  revalidatePath('/dispatch')
  return { success: true, id: dispatch.id }
}

/**
 * Update dispatch status — enforces created → picked_up → delivered ordering.
 * Returns { error: 'invalid_transition' } if the transition is not allowed.
 * reco-admin only.
 */
export async function updateDispatchStatus(
  id: string,
  newStatus: string
): Promise<{ success: true } | { error: string }> {
  const user = await requireRecoAdmin()

  // Fetch current status
  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: outboundDispatches.id, status: outboundDispatches.status })
      .from(outboundDispatches)
      .where(eq(outboundDispatches.id, id))
      .limit(1)
  })

  const record = rows[0]
  if (!record) {
    return { error: 'Dispatch record not found' }
  }

  const allowed = VALID_TRANSITIONS[record.status] ?? []
  if (!allowed.includes(newStatus)) {
    return { error: 'invalid_transition' }
  }

  await withRLSContext(user, async (tx) => {
    return tx
      .update(outboundDispatches)
      .set({ status: newStatus as 'created' | 'picked_up' | 'delivered', updated_at: new Date() })
      .where(eq(outboundDispatches.id, id))
  })

  revalidatePath('/dispatch')
  return { success: true }
}

/**
 * Void a dispatch record.
 * Sets voided=true and records the void reason.
 * reco-admin only.
 */
export async function voidDispatch(
  id: string,
  reason: string
): Promise<{ success: true } | { error: string }> {
  const user = await requireRecoAdmin()

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: outboundDispatches.id, voided: outboundDispatches.voided })
      .from(outboundDispatches)
      .where(eq(outboundDispatches.id, id))
      .limit(1)
  })

  const record = rows[0]
  if (!record) {
    return { error: 'Dispatch record not found' }
  }

  if (record.voided) {
    return { error: 'already_voided' }
  }

  await withRLSContext(user, async (tx) => {
    return tx
      .update(outboundDispatches)
      .set({ voided: true, void_reason: reason, updated_at: new Date() })
      .where(eq(outboundDispatches.id, id))
  })

  revalidatePath('/dispatch')
  return { success: true }
}

/**
 * Get a single dispatch record by id with its packing list lines.
 * reco-admin only.
 */
export type DispatchDetail = DispatchRecord & {
  lines: Array<{
    id: string
    product_id: string
    product_name: string | null
    size_bucket: string | null
    sku_code: string | null
    quantity: number
  }>
}

export async function getDispatchDetail(id: string): Promise<DispatchDetail | null> {
  const user = await requireRecoAdmin()

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select()
      .from(outboundDispatches)
      .where(and(eq(outboundDispatches.id, id), eq(outboundDispatches.voided, false)))
      .limit(1)
  })

  const dispatch = rows[0]
  if (!dispatch) return null

  const lineRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: outboundDispatchLines.id,
        product_id: outboundDispatchLines.product_id,
        size_bucket: outboundDispatchLines.size_bucket,
        sku_code: outboundDispatchLines.sku_code,
        quantity: outboundDispatchLines.quantity,
      })
      .from(outboundDispatchLines)
      .where(eq(outboundDispatchLines.outbound_dispatch_id, id))
  })

  // Fetch product names (raw db — products not visible via dispatch RLS)
  const productIds = [...new Set(lineRows.map((l) => l.product_id))]
  const productNames = productIds.length > 0
    ? await db.select({ id: products.id, name: products.name }).from(products).where(
        inArray(products.id, productIds)
      )
    : []

  const nameMap = new Map(productNames.map((p) => [p.id, p.name]))

  return {
    ...(dispatch as DispatchRecord),
    lines: lineRows.map((l) => ({
      id: l.id,
      product_id: l.product_id,
      product_name: nameMap.get(l.product_id) ?? null,
      size_bucket: l.size_bucket ?? null,
      sku_code: l.sku_code ?? null,
      quantity: l.quantity,
    })),
  }
}

/**
 * Get all non-voided dispatch records.
 * Optional facility filter for prison-context views.
 * RLS handles role scoping — reco-admin sees all, prison sees own facility.
 */
export async function getDispatches(facilityId?: string): Promise<DispatchRecord[]> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    const baseQuery = tx
      .select()
      .from(outboundDispatches)
      .where(
        facilityId
          ? and(
              eq(outboundDispatches.voided, false),
              eq(outboundDispatches.prison_facility_id, facilityId)
            )
          : eq(outboundDispatches.voided, false)
      )

    return baseQuery
  }) as Promise<DispatchRecord[]>
}

// --- Extended list type for ops dispatch list page ---

export type DispatchListItem = {
  id: string
  dispatch_date: Date
  facility_name: string | null
  tenant_name: string | null
  destination: string
  carrier: string | null
  status: string
  line_count: number
}

/**
 * Get all non-voided dispatch records with facility name, tenant name, and line counts.
 * Ordered by dispatch_date DESC. reco-admin only.
 */
export async function getDispatchList(): Promise<DispatchListItem[]> {
  const user = await requireRecoAdmin()

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: outboundDispatches.id,
        dispatch_date: outboundDispatches.dispatch_date,
        destination: outboundDispatches.destination,
        carrier: outboundDispatches.carrier,
        status: outboundDispatches.status,
        facility_name: prisonFacilities.name,
        tenant_name: tenants.name,
      })
      .from(outboundDispatches)
      .leftJoin(prisonFacilities, eq(prisonFacilities.id, outboundDispatches.prison_facility_id))
      .leftJoin(tenants, eq(tenants.id, outboundDispatches.tenant_id))
      .where(eq(outboundDispatches.voided, false))
      .orderBy(desc(outboundDispatches.dispatch_date))
  })

  if (rows.length === 0) return []

  const dispatchIds = rows.map((r) => r.id)
  const lineCounts = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        outbound_dispatch_id: outboundDispatchLines.outbound_dispatch_id,
        line_count: count(outboundDispatchLines.id),
      })
      .from(outboundDispatchLines)
      .where(inArray(outboundDispatchLines.outbound_dispatch_id, dispatchIds))
      .groupBy(outboundDispatchLines.outbound_dispatch_id)
  })

  const lineCountMap = new Map<string, number>()
  for (const lc of lineCounts) {
    lineCountMap.set(lc.outbound_dispatch_id, Number(lc.line_count))
  }

  return rows.map((r) => ({
    id: r.id,
    dispatch_date: r.dispatch_date,
    facility_name: r.facility_name ?? null,
    tenant_name: r.tenant_name ?? null,
    destination: r.destination,
    carrier: r.carrier ?? null,
    status: r.status,
    line_count: lineCountMap.get(r.id) ?? 0,
  }))
}

// --- Data for dispatch create form ---

export type FacilityOption = { id: string; name: string }
export type TenantOption = { id: string; name: string }
export type ProductOption = { id: string; name: string; product_category: string }

/**
 * Fetch facilities, tenants, and products for the dispatch create form.
 * Uses raw db for products — reco-admin can query them directly.
 */
export async function getDispatchFormData(): Promise<{
  facilities: FacilityOption[]
  tenants: TenantOption[]
  products: ProductOption[]
}> {
  await requireRecoAdmin()

  const [facilities, tenantsData, productsData] = await Promise.all([
    db.select({ id: prisonFacilities.id, name: prisonFacilities.name }).from(prisonFacilities),
    db.select({ id: tenants.id, name: tenants.name }).from(tenants).where(eq(tenants.active, true)),
    db.select({ id: products.id, name: products.name, product_category: products.product_category }).from(products).where(eq(products.active, true)),
  ])

  return {
    facilities: facilities.map((f) => ({ id: f.id, name: f.name })),
    tenants: tenantsData.map((t) => ({ id: t.id, name: t.name })),
    products: productsData.map((p) => ({
      id: p.id,
      name: p.name,
      product_category: p.product_category ?? 'other',
    })),
  }
}
