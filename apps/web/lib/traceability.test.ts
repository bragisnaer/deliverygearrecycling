import { describe, it, expect } from 'vitest'
import { assembleTraceabilityChain, type TraceabilityChain } from './traceability'

// --- Fixtures ---

const baseIntake = {
  id: 'intake-1',
  reference: 'IN-2026-0001',
  staff_name: 'Per Hansen',
  delivery_date: new Date('2026-03-01'),
  is_unexpected: false,
  prison_facility_id: 'facility-1',
  tenant_id: 'tenant-wolt',
}

const basePickup = {
  id: 'pickup-1',
  reference: 'PU-2026-0001',
  status: 'intake_registered' as const,
  created_at: new Date('2026-02-28'),
}

const baseTransport = {
  id: 'transport-1',
  type: 'direct' as const,
  provider: 'Bring',
  status: 'delivered' as const,
}

const washReport = {
  id: 'wash-1',
  staff_name: 'Per Hansen',
  report_date: new Date('2026-03-05'),
  product_name: 'Jakke',
}

const packReport = {
  id: 'pack-1',
  staff_name: 'Per Hansen',
  report_date: new Date('2026-03-06'),
  product_name: 'Jakke',
}

const directDispatch = {
  id: 'dispatch-1',
  dispatch_date: new Date('2026-03-10'),
  destination: 'SEKO Partner DK',
  status: 'delivered' as const,
}

const facilityDispatch1 = {
  id: 'dispatch-f1',
  dispatch_date: new Date('2026-03-10'),
  destination: 'SEKO Partner DK',
  status: 'delivered' as const,
}

const facilityDispatch2 = {
  id: 'dispatch-f2',
  dispatch_date: new Date('2026-03-15'),
  destination: 'SEKO Partner DK',
  status: 'created' as const,
}

// --- Tests ---

describe('assembleTraceabilityChain', () => {
  it('returns all 6 segments when all data is present with deterministic dispatch', () => {
    const chain = assembleTraceabilityChain({
      intake: baseIntake,
      pickup: basePickup,
      transport: baseTransport,
      washReports: [washReport],
      packReports: [packReport],
      directDispatch,
      facilityDispatches: [],
    })

    expect(chain.intake).toEqual(baseIntake)
    expect(chain.pickup).toEqual(basePickup)
    expect(chain.transport).toEqual(baseTransport)
    expect(chain.wash).toEqual(washReport)
    expect(chain.pack).toEqual(packReport)
    expect(chain.dispatch).toEqual(directDispatch)
    expect(chain.dispatchFallback).toBeNull()
  })

  it('returns pickup=null for unexpected deliveries (null pickup_id)', () => {
    const chain = assembleTraceabilityChain({
      intake: { ...baseIntake, is_unexpected: true },
      pickup: null,
      transport: null,
      washReports: [],
      packReports: [],
      directDispatch: null,
      facilityDispatches: [],
    })

    expect(chain.pickup).toBeNull()
    expect(chain.transport).toBeNull()
    expect(chain.intake.is_unexpected).toBe(true)
    expect(chain.wash).toBeNull()
    expect(chain.pack).toBeNull()
    expect(chain.dispatch).toBeNull()
    expect(chain.dispatchFallback).toBeNull()
  })

  it('returns empty wash and pack segments when no processing reports', () => {
    const chain = assembleTraceabilityChain({
      intake: baseIntake,
      pickup: basePickup,
      transport: baseTransport,
      washReports: [],
      packReports: [],
      directDispatch,
      facilityDispatches: [],
    })

    expect(chain.wash).toBeNull()
    expect(chain.pack).toBeNull()
    expect(chain.dispatch).toEqual(directDispatch)
  })

  it('returns dispatch=null and dispatchFallback=null when no dispatch at all', () => {
    const chain = assembleTraceabilityChain({
      intake: baseIntake,
      pickup: basePickup,
      transport: baseTransport,
      washReports: [washReport],
      packReports: [packReport],
      directDispatch: null,
      facilityDispatches: [],
    })

    expect(chain.dispatch).toBeNull()
    expect(chain.dispatchFallback).toBeNull()
  })

  it('uses directDispatch when intake_record_id is set — sets dispatch, dispatchFallback=null', () => {
    const chain = assembleTraceabilityChain({
      intake: baseIntake,
      pickup: basePickup,
      transport: baseTransport,
      washReports: [washReport],
      packReports: [packReport],
      directDispatch,
      facilityDispatches: [facilityDispatch1, facilityDispatch2], // ignored when directDispatch is set
    })

    expect(chain.dispatch).toEqual(directDispatch)
    expect(chain.dispatchFallback).toBeNull()
  })

  it('falls back to facilityDispatches when directDispatch is null — dispatch=null, dispatchFallback is array', () => {
    const chain = assembleTraceabilityChain({
      intake: baseIntake,
      pickup: basePickup,
      transport: baseTransport,
      washReports: [washReport],
      packReports: [packReport],
      directDispatch: null,
      facilityDispatches: [facilityDispatch1, facilityDispatch2],
    })

    expect(chain.dispatch).toBeNull()
    expect(chain.dispatchFallback).toHaveLength(2)
    expect(chain.dispatchFallback?.[0]).toEqual(facilityDispatch1)
    expect(chain.dispatchFallback?.[1]).toEqual(facilityDispatch2)
  })

  it('returns dispatchFallback=null when directDispatch is null and facilityDispatches is empty', () => {
    const chain = assembleTraceabilityChain({
      intake: baseIntake,
      pickup: basePickup,
      transport: baseTransport,
      washReports: [washReport],
      packReports: [packReport],
      directDispatch: null,
      facilityDispatches: [],
    })

    expect(chain.dispatch).toBeNull()
    expect(chain.dispatchFallback).toBeNull()
  })

  it('uses only the first wash report when multiple are present', () => {
    const washReport2 = { ...washReport, id: 'wash-2', report_date: new Date('2026-03-07') }
    const chain = assembleTraceabilityChain({
      intake: baseIntake,
      pickup: basePickup,
      transport: baseTransport,
      washReports: [washReport, washReport2],
      packReports: [packReport],
      directDispatch,
      facilityDispatches: [],
    })

    expect(chain.wash?.id).toBe('wash-1')
  })
})
