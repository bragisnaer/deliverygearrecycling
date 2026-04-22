import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @repo/db — no real DB connection
vi.mock('@repo/db', () => {
  return {
    db: { transaction: vi.fn() },
    withRLSContext: vi.fn(),
    pickups: {},
    pickupLines: {},
    products: {},
    locations: {},
    transportBookings: {},
    transportProviders: {},
    notifications: {},
    systemSettings: {},
    outboundShipments: {},
    outboundShipmentPickups: {},
  }
})

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

const SHIPMENT_ID = '00000000-0000-0000-0000-000000000001'
const PICKUP_ID_1 = '11111111-1111-1111-1111-111111111111'
const PICKUP_ID_2 = '22222222-2222-2222-2222-222222222222'
const PICKUP_ID_3 = '33333333-3333-3333-3333-333333333333'

describe('calculateProRataAllocation', () => {
  it('Test 1 (pro-rata default): 3 and 2 pallets with $1000 total', async () => {
    const { calculateProRataAllocation } = await import('./utils')
    const result = calculateProRataAllocation('1000.0000', [
      { pickupId: PICKUP_ID_1, palletCount: 3 },
      { pickupId: PICKUP_ID_2, palletCount: 2 },
    ])
    expect(result).toHaveLength(2)
    expect(result[0].allocatedCostEur).toBe('600.0000')
    expect(result[1].allocatedCostEur).toBe('400.0000')
  })

  it('Test 2 (pro-rata rounding): 3 equal pickups with $100 total sum to exactly 100', async () => {
    const { calculateProRataAllocation } = await import('./utils')
    const result = calculateProRataAllocation('100.0000', [
      { pickupId: PICKUP_ID_1, palletCount: 1 },
      { pickupId: PICKUP_ID_2, palletCount: 1 },
      { pickupId: PICKUP_ID_3, palletCount: 1 },
    ])
    expect(result).toHaveLength(3)
    // Sum must equal exactly 100.0000
    const total = result.reduce((sum, r) => sum + parseFloat(r.allocatedCostEur), 0)
    expect(total.toFixed(4)).toBe('100.0000')
  })
})

describe('markOutboundDelivered', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('Test 3 (cascade delivery): updates outbound_shipments status and all linked pickups status to delivered', async () => {
    let updateCallCount = 0
    let selectPickupIds: string[] = []

    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      updateCallCount++

      if (updateCallCount === 1) {
        // UPDATE outbound_shipments SET status='delivered'
        const tx = {
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return fn(tx as never)
      }

      if (updateCallCount === 2) {
        // SELECT pickup_ids from outbound_shipment_pickups
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { pickup_id: PICKUP_ID_1 },
                { pickup_id: PICKUP_ID_2 },
              ]),
            }),
          }),
        }
        const rows = await fn(tx as never)
        selectPickupIds = (rows as Array<{ pickup_id: string }>).map((r) => r.pickup_id)
        return rows
      }

      if (updateCallCount === 3) {
        // UPDATE pickups SET status='delivered'
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

    const { markOutboundDelivered } = await import('./utils')
    const result = await markOutboundDelivered(SHIPMENT_ID)

    expect(result).toEqual({ success: true })
    // Verify all 3 withRLSContext calls were made (update shipment, select pickups, update pickups)
    expect(vi.mocked(withRLSContext)).toHaveBeenCalledTimes(3)
    // Verify the correct pickup IDs were fetched
    expect(selectPickupIds).toEqual([PICKUP_ID_1, PICKUP_ID_2])
  })
})
