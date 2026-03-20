import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @repo/db — no real DB connection
vi.mock('@repo/db', () => {
  return {
    db: {},
    withRLSContext: vi.fn(),
    outboundDispatches: {},
    outboundDispatchLines: {},
  }
})

// Mock next/cache
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Mock @/auth to return a reco-admin session by default
const mockAuth = vi.fn().mockResolvedValue({
  user: {
    id: 'reco-admin-user-id',
    role: 'reco-admin',
    tenant_id: 'wolt',
    location_id: null,
  },
})

vi.mock('@/auth', () => ({
  auth: mockAuth,
}))

import { withRLSContext } from '@repo/db'

const DISPATCH_ID = '00000000-0000-0000-0000-000000000001'
const FACILITY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const TENANT_ID = 'wolt'
const PRODUCT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const INTAKE_RECORD_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

// -----------------------------------------------------------------------
// VALID_TRANSITIONS (pure logic — no DB or auth needed)
// -----------------------------------------------------------------------

describe('VALID_TRANSITIONS (lifecycle ordering)', () => {
  it('allows created -> picked_up', async () => {
    const { VALID_TRANSITIONS } = await import('./actions')
    expect(VALID_TRANSITIONS['created']).toContain('picked_up')
  })

  it('does NOT allow created -> delivered', async () => {
    const { VALID_TRANSITIONS } = await import('./actions')
    expect(VALID_TRANSITIONS['created']).not.toContain('delivered')
  })

  it('allows picked_up -> delivered', async () => {
    const { VALID_TRANSITIONS } = await import('./actions')
    expect(VALID_TRANSITIONS['picked_up']).toContain('delivered')
  })

  it('does NOT allow delivered -> created (terminal state)', async () => {
    const { VALID_TRANSITIONS } = await import('./actions')
    expect(VALID_TRANSITIONS['delivered']).toHaveLength(0)
  })
})

// -----------------------------------------------------------------------
// createDispatch
// -----------------------------------------------------------------------

describe('createDispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('rejects non-reco-admin with Unauthorized error', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'prison-user', role: 'prison', tenant_id: 'wolt' },
    })

    const { createDispatch } = await import('./actions')
    await expect(
      createDispatch({
        prison_facility_id: FACILITY_ID,
        tenant_id: TENANT_ID,
        dispatch_date: new Date(),
        destination: 'Redistribution Partner HQ',
        lines: [{ product_id: PRODUCT_ID, quantity: 10 }],
      })
    ).rejects.toThrow('Unauthorized: reco-admin role required')
  })

  it('accepts optional intake_record_id and returns success with id', async () => {
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: DISPATCH_ID }]),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { createDispatch } = await import('./actions')
    const result = await createDispatch({
      prison_facility_id: FACILITY_ID,
      tenant_id: TENANT_ID,
      intake_record_id: INTAKE_RECORD_ID,
      dispatch_date: new Date(),
      destination: 'Redistribution Partner HQ',
      lines: [{ product_id: PRODUCT_ID, quantity: 10 }],
    })

    expect(result).toEqual({ success: true, id: DISPATCH_ID })
  })

  it('creates dispatch without intake_record_id (facility-level fallback)', async () => {
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: DISPATCH_ID }]),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { createDispatch } = await import('./actions')
    const result = await createDispatch({
      prison_facility_id: FACILITY_ID,
      tenant_id: TENANT_ID,
      dispatch_date: new Date(),
      destination: 'Redistribution Partner HQ',
      lines: [{ product_id: PRODUCT_ID, quantity: 5 }],
    })

    expect(result).toEqual({ success: true, id: DISPATCH_ID })
  })
})

// -----------------------------------------------------------------------
// updateDispatchStatus
// -----------------------------------------------------------------------

describe('updateDispatchStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('succeeds on valid transition created -> picked_up', async () => {
    let selectCallCount = 0

    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      selectCallCount++

      if (selectCallCount === 1) {
        // First call: select current status
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: DISPATCH_ID, status: 'created' }]),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }

      // Second call: update status
      const tx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { updateDispatchStatus } = await import('./actions')
    const result = await updateDispatchStatus(DISPATCH_ID, 'picked_up')
    expect(result).toEqual({ success: true })
  })

  it('returns invalid_transition for created -> delivered (skips step)', async () => {
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: DISPATCH_ID, status: 'created' }]),
            }),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { updateDispatchStatus } = await import('./actions')
    const result = await updateDispatchStatus(DISPATCH_ID, 'delivered')
    expect(result).toEqual({ error: 'invalid_transition' })
  })

  it('returns invalid_transition for delivered -> created (backwards)', async () => {
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: DISPATCH_ID, status: 'delivered' }]),
            }),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { updateDispatchStatus } = await import('./actions')
    const result = await updateDispatchStatus(DISPATCH_ID, 'created')
    expect(result).toEqual({ error: 'invalid_transition' })
  })
})

// -----------------------------------------------------------------------
// getDispatches
// -----------------------------------------------------------------------

describe('getDispatches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('returns only non-voided records', async () => {
    const mockRows = [
      { id: DISPATCH_ID, destination: 'Partner HQ', voided: false },
    ]

    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockRows),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { getDispatches } = await import('./actions')
    const result = await getDispatches()
    expect(result).toEqual(mockRows)
  })
})
