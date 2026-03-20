'use server'

import { auth } from '@/auth'
import {
  db,
  intakeRecords,
  prisonFacilities,
  tenants,
  withRLSContext,
} from '@repo/db'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

export type IntakeQueueItem = {
  id: string
  reference: string
  facility_name: string
  client_name: string
  staff_name: string
  delivery_date: Date
  origin_market: string | null
  is_unexpected: boolean
  discrepancy_flagged: boolean
  quarantine_flagged: boolean
  quarantine_overridden: boolean
  created_at: Date
}

export type QuarantinedIntake = {
  id: string
  reference: string
  facility_name: string
  client_name: string
  staff_name: string
  delivery_date: Date
  origin_market: string | null
}

// --- Server Actions ---

/**
 * Get all intake records with optional filter for the ops queue.
 * Filter options: 'all' | 'discrepancy' | 'quarantine' | 'unexpected'
 */
export async function getIntakeQueue(
  filter?: 'all' | 'discrepancy' | 'quarantine' | 'unexpected'
): Promise<IntakeQueueItem[]> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    const baseQuery = tx
      .select({
        id: intakeRecords.id,
        reference: intakeRecords.reference,
        facility_name: prisonFacilities.name,
        client_name: tenants.name,
        staff_name: intakeRecords.staff_name,
        delivery_date: intakeRecords.delivery_date,
        origin_market: intakeRecords.origin_market,
        is_unexpected: intakeRecords.is_unexpected,
        discrepancy_flagged: intakeRecords.discrepancy_flagged,
        quarantine_flagged: intakeRecords.quarantine_flagged,
        quarantine_overridden: intakeRecords.quarantine_overridden,
        created_at: intakeRecords.created_at,
      })
      .from(intakeRecords)
      .leftJoin(prisonFacilities, eq(prisonFacilities.id, intakeRecords.prison_facility_id))
      .leftJoin(tenants, eq(tenants.id, intakeRecords.tenant_id))
      .orderBy(intakeRecords.created_at)

    if (filter === 'discrepancy') {
      return baseQuery.where(eq(intakeRecords.discrepancy_flagged, true))
    }

    if (filter === 'quarantine') {
      return baseQuery.where(
        and(
          eq(intakeRecords.quarantine_flagged, true),
          eq(intakeRecords.quarantine_overridden, false)
        )
      )
    }

    if (filter === 'unexpected') {
      return baseQuery.where(eq(intakeRecords.is_unexpected, true))
    }

    // 'all' or undefined — no filter
    return baseQuery
  })
}

/**
 * Get all quarantine-blocked intake records (quarantine_flagged=true and not yet overridden).
 */
export async function getQuarantinedIntakes(): Promise<QuarantinedIntake[]> {
  const user = await requireRecoAdmin()

  return withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: intakeRecords.id,
        reference: intakeRecords.reference,
        facility_name: prisonFacilities.name,
        client_name: tenants.name,
        staff_name: intakeRecords.staff_name,
        delivery_date: intakeRecords.delivery_date,
        origin_market: intakeRecords.origin_market,
      })
      .from(intakeRecords)
      .leftJoin(prisonFacilities, eq(prisonFacilities.id, intakeRecords.prison_facility_id))
      .leftJoin(tenants, eq(tenants.id, intakeRecords.tenant_id))
      .where(
        and(
          eq(intakeRecords.quarantine_flagged, true),
          eq(intakeRecords.quarantine_overridden, false)
        )
      )
      .orderBy(intakeRecords.created_at)
  })
}

/**
 * Override a quarantine block on an intake record.
 * Requires a reason of at least 10 characters.
 */
export async function overrideQuarantine(
  intakeRecordId: string,
  reason: string
): Promise<{ success: boolean } | { error: string }> {
  const user = await requireRecoAdmin()

  const validatedId = z.string().uuid().parse(intakeRecordId)

  if (!reason || reason.trim().length < 10) {
    return { error: 'Override reason must be at least 10 characters' }
  }

  // Verify record exists and is quarantine-flagged
  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: intakeRecords.id,
        quarantine_flagged: intakeRecords.quarantine_flagged,
        quarantine_overridden: intakeRecords.quarantine_overridden,
      })
      .from(intakeRecords)
      .where(eq(intakeRecords.id, validatedId))
      .limit(1)
  })

  const record = rows[0]
  if (!record) {
    return { error: 'Intake record not found' }
  }

  if (!record.quarantine_flagged) {
    return { error: 'Intake record is not quarantine-flagged' }
  }

  if (record.quarantine_overridden) {
    return { error: 'Quarantine has already been overridden for this record' }
  }

  await withRLSContext(user, async (tx) => {
    return tx
      .update(intakeRecords)
      .set({
        quarantine_overridden: true,
        quarantine_override_reason: reason.trim(),
        quarantine_overridden_by: user.id as unknown as string,
        quarantine_overridden_at: new Date(),
        updated_at: new Date(),
      })
      .where(eq(intakeRecords.id, validatedId))
  })

  revalidatePath('/intake')
  return { success: true }
}
