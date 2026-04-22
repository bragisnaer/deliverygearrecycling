import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @repo/db — no real DB connection
vi.mock('@repo/db', () => {
  const selectChain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    limit: vi.fn().mockResolvedValue([]),
    leftJoin: vi.fn().mockReturnThis(),
  }
  return {
    db: selectChain,
    withRLSContext: vi.fn(),
    pickups: {},
    pickupLines: {},
    products: {},
    locations: {},
    users: {},
    eq: vi.fn(),
    and: vi.fn(),
  }
})

// Mock @/lib/notification-events — prevents real DB/email calls from notification dispatch
vi.mock('@/lib/notification-events', () => ({
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
  getRecoAdminEmails: vi.fn().mockResolvedValue([]),
}))

// Mock next/cache
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Mock next/navigation
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

// Mock @/auth to return a reco-admin session
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: 'reco-admin-user-id',
      role: 'reco-admin',
      tenant_id: 'wolt',
      location_id: null,
      sub: 'reco-admin-user-id',
    },
  }),
}))

// Mock @/lib/auth-guard
vi.mock('@/lib/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: {
      id: 'reco-admin-user-id',
      role: 'reco-admin',
      tenant_id: 'wolt',
      location_id: null,
    },
  }),
}))

import { withRLSContext } from '@repo/db'

const PICKUP_ID = '00000000-0000-0000-0000-000000000001'

describe('confirmPickup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('Test 1 (status guard): returns error when pickup status is not submitted', async () => {
    // Pickup already confirmed — cannot confirm again
    vi.mocked(withRLSContext).mockImplementationOnce(async (_claims, fn) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: PICKUP_ID, status: 'confirmed' }]),
            }),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { confirmPickup } = await import('./actions')
    const result = await confirmPickup(PICKUP_ID)

    expect(result).toEqual({ error: 'Can only confirm pickups with submitted status' })
  })

  it('Test 2 (happy path): returns success when pickup status is submitted', async () => {
    let callCount = 0
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      callCount++
      if (callCount === 1) {
        // Fetch pickup status
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: PICKUP_ID, status: 'submitted' }]),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 2) {
        // Fetch pickup details for notification (Phase 9 addition)
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{
                    reference: 'PU-001',
                    tenant_id: 'wolt',
                    submitted_by: null,
                    location_name: 'Wolt HQ',
                    confirmed_date: null,
                  }]),
                }),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 3) {
        // Update pickup status
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return fn(tx as never)
      }
      return undefined
    })

    const { confirmPickup } = await import('./actions')
    const result = await confirmPickup(PICKUP_ID)

    expect(result).toEqual({ success: true })
  })
})

describe('cancelPickup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('Test 3 (reason required): returns error when reason is empty', async () => {
    const { cancelPickup } = await import('./actions')
    const result = await cancelPickup(PICKUP_ID, '')

    expect(result).toEqual({ error: 'Cancellation reason is required' })
  })

  it('Test 4 (terminal status guard): returns error when pickup status is delivered', async () => {
    vi.mocked(withRLSContext).mockImplementationOnce(async (_claims, fn) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: PICKUP_ID, status: 'delivered' }]),
            }),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { cancelPickup } = await import('./actions')
    const result = await cancelPickup(PICKUP_ID, 'Some reason')

    expect(result).toEqual({ error: 'Cannot cancel a pickup in terminal status' })
  })

  it('Test 5 (happy path): returns success when status is confirmed and reason is provided', async () => {
    let callCount = 0
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      callCount++
      if (callCount === 1) {
        // Fetch pickup
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: PICKUP_ID, status: 'confirmed' }]),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 2) {
        // Update pickup
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return fn(tx as never)
      }
      return undefined
    })

    const { cancelPickup } = await import('./actions')
    const result = await cancelPickup(PICKUP_ID, 'Rescheduled by client')

    expect(result).toEqual({ success: true })
  })
})
