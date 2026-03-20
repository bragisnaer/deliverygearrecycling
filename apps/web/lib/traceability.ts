/**
 * Traceability chain assembly — PROCESS-05
 *
 * Provides the `TraceabilityChain` type and `assembleTraceabilityChain` pure function
 * for building the full linked record path from pickup through dispatch.
 *
 * Dispatch resolution strategy:
 *   1. Deterministic (preferred): directDispatch via intake_record_id FK on outbound_dispatches
 *   2. Non-deterministic fallback: facilityDispatches via prison_facility_id + tenant_id
 *   3. None: both dispatch and dispatchFallback are null
 */

export interface DispatchLink {
  id: string
  dispatch_date: Date
  destination: string
  status: string
}

export interface TraceabilityChain {
  /** Null for unexpected deliveries (intake with no pickup_id) */
  pickup: { id: string; reference: string; status: string; created_at: Date } | null
  /** Null when pickup is null, or when no transport booking found */
  transport: { id: string; type: string; provider?: string; status: string } | null
  /** Always present — the anchor record of the chain */
  intake: {
    id: string
    reference: string
    staff_name: string
    delivery_date: Date
    is_unexpected: boolean
    prison_facility_id: string
    tenant_id: string
  }
  /** First non-voided wash report linked to this intake; null when none */
  wash: { id: string; staff_name: string; report_date: Date; product_name: string } | null
  /** First non-voided pack report linked to this intake; null when none */
  pack: { id: string; staff_name: string; report_date: Date; product_name: string } | null
  /**
   * Deterministic single dispatch found via intake_record_id FK.
   * Null when intake_record_id is not set on any dispatch for this intake.
   * When set, `dispatchFallback` is always null.
   */
  dispatch: DispatchLink | null
  /**
   * Non-deterministic fallback dispatches found via prison_facility_id + tenant_id.
   * Only set when `dispatch` is null and at least one facility dispatch exists.
   * Null when `dispatch` is set, or when no facility dispatches found.
   */
  dispatchFallback: DispatchLink[] | null
}

interface AssembleInput {
  intake: TraceabilityChain['intake']
  pickup: TraceabilityChain['pickup']
  transport: TraceabilityChain['transport']
  washReports: Array<{ id: string; staff_name: string; report_date: Date; product_name: string }>
  packReports: Array<{ id: string; staff_name: string; report_date: Date; product_name: string }>
  /** Found via outbound_dispatches WHERE intake_record_id = intakeRecordId AND voided = false */
  directDispatch: DispatchLink | null
  /** Found via outbound_dispatches WHERE prison_facility_id = ... AND tenant_id = ... AND voided = false */
  facilityDispatches: DispatchLink[]
}

/**
 * Assembles a TraceabilityChain from pre-fetched query results.
 * Pure function — no DB access. All filtering (voided=false) happens in the caller.
 *
 * Dispatch precedence:
 * - If directDispatch is set → use it as deterministic link; dispatchFallback = null
 * - If directDispatch is null and facilityDispatches has entries → dispatch = null, dispatchFallback = array
 * - If both empty → dispatch = null, dispatchFallback = null
 */
export function assembleTraceabilityChain(data: AssembleInput): TraceabilityChain {
  const hasDirect = data.directDispatch !== null

  return {
    pickup: data.pickup,
    transport: data.transport,
    intake: data.intake,
    wash: data.washReports[0] ?? null,
    pack: data.packReports[0] ?? null,
    dispatch: data.directDispatch,
    dispatchFallback: hasDirect
      ? null
      : data.facilityDispatches.length > 0
        ? data.facilityDispatches
        : null,
  }
}
