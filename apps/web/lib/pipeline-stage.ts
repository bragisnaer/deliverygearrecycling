/**
 * Pipeline stage derivation — pure function, no side effects.
 *
 * Derives which processing stage an intake record is currently in, based on
 * the presence/absence of processing reports (wash/pack) and dispatch records.
 *
 * Stage progression:
 *   awaiting_processing → in_progress → ready_to_ship → shipped
 *
 * Voided intake records should be excluded by the caller before invoking this.
 */

export type PipelineStage = 'awaiting_processing' | 'in_progress' | 'ready_to_ship' | 'shipped'

export interface PipelineInput {
  hasWashReport: boolean
  hasPackReport: boolean
  hasDispatch: boolean
}

/**
 * Derive the current pipeline stage for an intake record.
 *
 * Priority order (highest first):
 * 1. Has dispatch → 'shipped'
 * 2. Has pack report → 'ready_to_ship'
 * 3. Has wash report → 'in_progress'
 * 4. None → 'awaiting_processing'
 */
export function derivePipelineStage(input: PipelineInput): PipelineStage {
  if (input.hasDispatch) return 'shipped'
  if (input.hasPackReport) return 'ready_to_ship'
  if (input.hasWashReport) return 'in_progress'
  return 'awaiting_processing'
}

/**
 * Ordered list of all pipeline stages from first to last.
 * Use this for rendering stage columns in the correct order.
 */
export const STAGE_ORDER: PipelineStage[] = [
  'awaiting_processing',
  'in_progress',
  'ready_to_ship',
  'shipped',
]

/**
 * Danish display labels for each pipeline stage.
 * Used in the ops processing pipeline view.
 */
export const STAGE_LABELS: Record<PipelineStage, string> = {
  awaiting_processing: 'Afventer behandling',
  in_progress: 'Under behandling',
  ready_to_ship: 'Klar til forsendelse',
  shipped: 'Afsendt',
}
