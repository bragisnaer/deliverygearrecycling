import { describe, expect, it } from 'vitest'
import {
  derivePipelineStage,
  STAGE_LABELS,
  STAGE_ORDER,
  type PipelineInput,
  type PipelineStage,
} from './pipeline-stage'

describe('derivePipelineStage', () => {
  it('returns awaiting_processing when no reports exist', () => {
    const input: PipelineInput = {
      hasWashReport: false,
      hasPackReport: false,
      hasDispatch: false,
    }
    expect(derivePipelineStage(input)).toBe<PipelineStage>('awaiting_processing')
  })

  it('returns in_progress when wash report exists but no pack report', () => {
    const input: PipelineInput = {
      hasWashReport: true,
      hasPackReport: false,
      hasDispatch: false,
    }
    expect(derivePipelineStage(input)).toBe<PipelineStage>('in_progress')
  })

  it('returns ready_to_ship when pack report exists but no dispatch', () => {
    const input: PipelineInput = {
      hasWashReport: true,
      hasPackReport: true,
      hasDispatch: false,
    }
    expect(derivePipelineStage(input)).toBe<PipelineStage>('ready_to_ship')
  })

  it('returns ready_to_ship for pack-only (no wash) when no dispatch', () => {
    // pack without wash is unusual but derivation should still work deterministically
    const input: PipelineInput = {
      hasWashReport: false,
      hasPackReport: true,
      hasDispatch: false,
    }
    expect(derivePipelineStage(input)).toBe<PipelineStage>('ready_to_ship')
  })

  it('returns shipped when dispatch record exists', () => {
    const input: PipelineInput = {
      hasWashReport: true,
      hasPackReport: true,
      hasDispatch: true,
    }
    expect(derivePipelineStage(input)).toBe<PipelineStage>('shipped')
  })

  it('returns shipped even if only dispatch exists (dispatch takes precedence)', () => {
    const input: PipelineInput = {
      hasWashReport: false,
      hasPackReport: false,
      hasDispatch: true,
    }
    expect(derivePipelineStage(input)).toBe<PipelineStage>('shipped')
  })
})

describe('STAGE_ORDER', () => {
  it('has exactly four stages in correct pipeline order', () => {
    expect(STAGE_ORDER).toEqual([
      'awaiting_processing',
      'in_progress',
      'ready_to_ship',
      'shipped',
    ])
  })
})

describe('STAGE_LABELS', () => {
  it('has a Danish label for every stage in STAGE_ORDER', () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_LABELS[stage]).toBeTruthy()
    }
  })

  it('has correct Danish labels', () => {
    expect(STAGE_LABELS.awaiting_processing).toBe('Afventer behandling')
    expect(STAGE_LABELS.in_progress).toBe('Under behandling')
    expect(STAGE_LABELS.ready_to_ship).toBe('Klar til forsendelse')
    expect(STAGE_LABELS.shipped).toBe('Afsendt')
  })
})
