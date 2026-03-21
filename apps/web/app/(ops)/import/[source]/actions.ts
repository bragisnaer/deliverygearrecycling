'use server'

import { auth } from '@/auth'
import {
  db,
  withRLSContext,
  importJobs,
  pickups,
  pickupLines,
  intakeRecords,
  intakeLines,
  processingReports,
  financialRecords,
  transportBookings,
} from '@repo/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// ── Auth helper ───────────────────────────────────────────────────────────────

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

// ── getImportJob ──────────────────────────────────────────────────────────────

export async function getImportJob(jobId: string) {
  await requireRecoAdmin()

  const rows = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, jobId))
    .limit(1)

  return rows[0] ?? null
}

// ── commitImport ──────────────────────────────────────────────────────────────

export async function commitImport(
  jobId: string
): Promise<{ success: true; importedCount: number }> {
  const user = await requireRecoAdmin()

  // Load job
  const jobRows = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.id, jobId))
    .limit(1)

  const job = jobRows[0]
  if (!job) {
    throw new Error('Job not found or not ready for commit')
  }

  // Guard: already committed
  if (job.status === 'committed') {
    throw new Error('Job already committed')
  }

  // Guard: must be ready
  if (job.status !== 'ready') {
    throw new Error('Job not found or not ready for commit')
  }

  // Parse rows from job.rows_json
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = JSON.parse(job.rows_json) as Record<string, any>[]

  const source = job.source
  const tenantId = job.target_tenant_id

  const jwtClaims = {
    sub: user.sub,
    role: 'reco-admin' as const,
    tenant_id: tenantId,
  }

  // ── Per-source insert logic ─────────────────────────────────────────────────

  switch (source) {
    case 'pickup_log': {
      await withRLSContext(jwtClaims, async (tx) => {
        for (const row of rows) {
          const inserted = await tx
            .insert(pickups)
            .values({
              tenant_id: tenantId,
              location_id: row.location_id,
              pallet_count: row.pallet_count,
              preferred_date: new Date(row.preferred_date),
              status: row.status || 'delivered',
              notes: row.notes || null,
              submitted_by: user.sub,
              is_imported: true,
            })
            .onConflictDoNothing()
            .returning({ id: pickups.id })

          const pickup = inserted[0]
          if (pickup && row.lines && Array.isArray(row.lines)) {
            await tx.insert(pickupLines).values(
              row.lines.map((l: { product_id: string; quantity: number }) => ({
                pickup_id: pickup.id,
                product_id: l.product_id,
                quantity: l.quantity,
              }))
            )
          }
        }
      })
      break
    }

    case 'intake_log': {
      await withRLSContext(jwtClaims, async (tx) => {
        for (const row of rows) {
          const inserted = await tx
            .insert(intakeRecords)
            .values({
              tenant_id: tenantId,
              prison_facility_id: row.prison_facility_id,
              staff_name: row.staff_name,
              delivery_date: new Date(row.delivery_date),
              origin_market: row.origin_market || null,
              notes: row.notes || null,
              is_unexpected: false,
              is_imported: true,
              submitted_by: user.sub,
            })
            .onConflictDoNothing()
            .returning({ id: intakeRecords.id })

          const record = inserted[0]
          if (record && row.lines && Array.isArray(row.lines)) {
            await tx.insert(intakeLines).values(
              row.lines.map((l: {
                product_id: string
                actual_quantity: number
                informed_quantity?: number
                batch_lot_number?: string
              }) => ({
                intake_record_id: record.id,
                product_id: l.product_id,
                actual_quantity: l.actual_quantity,
                informed_quantity: l.informed_quantity ?? null,
                batch_lot_number: l.batch_lot_number ?? null,
              }))
            )
          }
        }
      })
      break
    }

    case 'greenloop': {
      await withRLSContext(jwtClaims, async (tx) => {
        for (const row of rows) {
          await tx
            .insert(processingReports)
            .values({
              tenant_id: tenantId,
              prison_facility_id: row.prison_facility_id,
              staff_name: row.staff_name,
              activity_type: row.activity_type,
              product_id: row.product_id,
              report_date: new Date(row.report_date),
              notes: row.notes || null,
              is_imported: true,
              submitted_by: user.sub,
            })
            .onConflictDoNothing()
        }
      })
      break
    }

    case 'invoice_binder': {
      // UPDATE existing financial_records (trigger already created them from intake import)
      await withRLSContext(jwtClaims, async (tx) => {
        for (const row of rows) {
          await tx
            .update(financialRecords)
            .set({
              invoice_status: row.invoice_status,
              invoice_number: row.invoice_number || null,
              invoice_date: row.invoice_date ? new Date(row.invoice_date) : null,
              notes: row.notes || null,
              updated_at: new Date(),
            })
            .where(eq(financialRecords.intake_record_id, row.intake_record_id))
        }
      })
      break
    }

    case 'transport_costs': {
      await withRLSContext(jwtClaims, async (tx) => {
        for (const row of rows) {
          // Attempt UPDATE first on existing transport_bookings by pickup_id
          const existingRows = await tx
            .select({ id: transportBookings.id })
            .from(transportBookings)
            .where(eq(transportBookings.pickup_id, row.pickup_id))
            .limit(1)

          if (existingRows.length > 0) {
            await tx
              .update(transportBookings)
              .set({
                transport_provider_id: row.transport_provider_id,
                transport_type: row.transport_type,
                transport_cost_market_to_destination_eur: String(row.transport_cost_eur),
                updated_at: new Date(),
              })
              .where(eq(transportBookings.pickup_id, row.pickup_id))
          } else {
            await tx
              .insert(transportBookings)
              .values({
                pickup_id: row.pickup_id,
                transport_provider_id: row.transport_provider_id,
                transport_type: row.transport_type,
                transport_cost_market_to_destination_eur: String(row.transport_cost_eur),
                is_imported: true,
              })
              .onConflictDoNothing()
          }
        }
      })
      break
    }

    default: {
      throw new Error(`Unknown import source: ${source}`)
    }
  }

  // Update import_jobs status to 'committed'
  await db
    .update(importJobs)
    .set({
      status: 'committed',
      committed_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(importJobs.id, jobId))

  revalidatePath('/import')

  return { success: true, importedCount: rows.length }
}
