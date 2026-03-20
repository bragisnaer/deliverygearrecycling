'use server'

import { auth } from '@/auth'
import {
  db,
  processingReports,
  intakeRecords,
  outboundDispatches,
  prisonFacilities,
  tenants,
  auditLog,
  withRLSContext,
} from '@repo/db'
import { derivePipelineStage, type PipelineStage } from '@/lib/pipeline-stage'
import { and, eq, inArray } from 'drizzle-orm'

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

export interface ProcessingReportCard {
  id: string
  activity_type: 'wash' | 'pack'
  staff_name: string
  report_date: Date
  isEdited: boolean
}

export interface PipelineIntakeItem {
  id: string
  reference: string
  facility_name: string | null
  client_name: string | null
  staff_name: string
  delivery_date: Date
  origin_market: string | null
  stage: PipelineStage
  washReport: ProcessingReportCard | null
  packReport: ProcessingReportCard | null
}

export type PipelineData = Record<PipelineStage, PipelineIntakeItem[]>

// --- Server Actions ---

/**
 * Get all non-voided intake records grouped by pipeline stage.
 *
 * For prison role: RLS automatically filters to own facility.
 * For reco-admin: optional facilityId narrows to a single facility.
 *
 * Each item includes wash/pack report data with isEdited boolean (AUDIT-05).
 */
export async function getPipelineData(facilityId?: string): Promise<PipelineData> {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const user = { ...session.user, sub: session.user.id! }

  // Step 1: fetch non-voided intake records with their facility and tenant names
  const intakeRows = await withRLSContext(user, async (tx) => {
    const query = tx
      .select({
        id: intakeRecords.id,
        reference: intakeRecords.reference,
        facility_name: prisonFacilities.name,
        client_name: tenants.name,
        staff_name: intakeRecords.staff_name,
        delivery_date: intakeRecords.delivery_date,
        origin_market: intakeRecords.origin_market,
        prison_facility_id: intakeRecords.prison_facility_id,
      })
      .from(intakeRecords)
      .leftJoin(prisonFacilities, eq(prisonFacilities.id, intakeRecords.prison_facility_id))
      .leftJoin(tenants, eq(tenants.id, intakeRecords.tenant_id))
      .where(
        facilityId
          ? and(
              eq(intakeRecords.voided, false),
              eq(intakeRecords.prison_facility_id, facilityId)
            )
          : eq(intakeRecords.voided, false)
      )

    return query
  })

  if (intakeRows.length === 0) {
    return {
      awaiting_processing: [],
      in_progress: [],
      ready_to_ship: [],
      shipped: [],
    }
  }

  const intakeIds = intakeRows.map((r) => r.id)

  // Step 2: fetch all processing reports for these intake records in one query
  const reportRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: processingReports.id,
        intake_record_id: processingReports.intake_record_id,
        activity_type: processingReports.activity_type,
        staff_name: processingReports.staff_name,
        report_date: processingReports.report_date,
      })
      .from(processingReports)
      .where(
        and(
          inArray(processingReports.intake_record_id, intakeIds),
          eq(processingReports.voided, false)
        )
      )
  })

  // Step 3: fetch all dispatch records for these intake records in one query
  const dispatchRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: outboundDispatches.id,
        intake_record_id: outboundDispatches.intake_record_id,
      })
      .from(outboundDispatches)
      .where(
        and(
          inArray(outboundDispatches.intake_record_id, intakeIds),
          eq(outboundDispatches.voided, false)
        )
      )
  })

  // Step 4: fetch audit_log entries for all processing reports to determine isEdited
  const reportIds = reportRows.map((r) => r.id)
  const auditRows =
    reportIds.length > 0
      ? await db
          .select({
            record_id: auditLog.record_id,
            action: auditLog.action,
          })
          .from(auditLog)
          .where(
            and(
              eq(auditLog.table_name, 'processing_reports'),
              inArray(auditLog.record_id, reportIds),
              eq(auditLog.action, 'UPDATE')
            )
          )
      : []

  // Build a set of edited report IDs for O(1) lookup
  const editedReportIds = new Set(auditRows.map((a) => a.record_id))

  // Index reports and dispatches by intake_record_id
  const washByIntake = new Map<string, (typeof reportRows)[number]>()
  const packByIntake = new Map<string, (typeof reportRows)[number]>()
  const dispatchByIntake = new Map<string, boolean>()

  for (const report of reportRows) {
    if (!report.intake_record_id) continue
    if (report.activity_type === 'wash') {
      washByIntake.set(report.intake_record_id, report)
    } else if (report.activity_type === 'pack') {
      packByIntake.set(report.intake_record_id, report)
    }
  }

  for (const dispatch of dispatchRows) {
    if (dispatch.intake_record_id) {
      dispatchByIntake.set(dispatch.intake_record_id, true)
    }
  }

  // Step 5: derive stage and build pipeline items
  const pipeline: PipelineData = {
    awaiting_processing: [],
    in_progress: [],
    ready_to_ship: [],
    shipped: [],
  }

  for (const intake of intakeRows) {
    const washRow = washByIntake.get(intake.id) ?? null
    const packRow = packByIntake.get(intake.id) ?? null
    const hasDispatch = dispatchByIntake.get(intake.id) ?? false

    const stage = derivePipelineStage({
      hasWashReport: washRow !== null,
      hasPackReport: packRow !== null,
      hasDispatch,
    })

    const toCard = (
      row: (typeof reportRows)[number] | null
    ): ProcessingReportCard | null => {
      if (!row) return null
      return {
        id: row.id,
        activity_type: row.activity_type,
        staff_name: row.staff_name,
        report_date: row.report_date,
        isEdited: editedReportIds.has(row.id),
      }
    }

    pipeline[stage].push({
      id: intake.id,
      reference: intake.reference,
      facility_name: intake.facility_name,
      client_name: intake.client_name,
      staff_name: intake.staff_name,
      delivery_date: intake.delivery_date,
      origin_market: intake.origin_market,
      stage,
      washReport: toCard(washRow),
      packReport: toCard(packRow),
    })
  }

  return pipeline
}

/**
 * Fetch edit history for a processing report from audit_log.
 * Uses raw db (no RLS) — audit_log has no RLS policies.
 */
export async function getProcessingReportEditHistory(reportId: string) {
  await requireRecoAdmin()

  return db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.table_name, 'processing_reports'),
        eq(auditLog.record_id, reportId),
        eq(auditLog.action, 'UPDATE')
      )
    )
    .orderBy(auditLog.changed_at)
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
