'use server'

import { auth } from '@/auth'
import {
  processingReports,
  withRLSContext,
} from '@repo/db'
import { eq } from 'drizzle-orm'

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

// --- Edit Actions (AUDIT-02, AUDIT-03) ---

/**
 * Admin edit of a processing report — no 48-hour restriction (AUDIT-03).
 * Requires reco-admin role.
 */
export async function editProcessingReportAdmin(
  id: string,
  updates: {
    staff_name?: string
    report_date?: Date
    notes?: string
  }
): Promise<{ success: true } | { error: string }> {
  const user = await requireRecoAdmin()

  // No 48-hour check — AUDIT-03
  await withRLSContext(user, async (tx) =>
    tx
      .update(processingReports)
      .set({ ...updates, updated_at: new Date() })
      .where(eq(processingReports.id, id))
  )

  return { success: true }
}
