'use server'

import { auth } from '@/auth'
import { db, withRLSContext, outboundDispatches, outboundDispatchLines } from '@repo/db'
import { eq, and } from 'drizzle-orm'
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
