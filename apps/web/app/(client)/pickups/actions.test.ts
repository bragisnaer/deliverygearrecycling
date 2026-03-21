import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @repo/db — no real DB connection
vi.mock('@repo/db', () => {
  return {
    db: {
      transaction: vi.fn(),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    },
    withRLSContext: vi.fn(),
    pickups: {},
    pickupLines: {},
    products: {},
    locations: {},
    notifications: {},
    users: {},
  }
})

// Mock @/lib/email
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock email templates
vi.mock('@/emails/pickup-confirmation', () => ({
  default: vi.fn().mockReturnValue(null),
}))

vi.mock('@/emails/pickup-admin-alert', () => ({
  default: vi.fn().mockReturnValue(null),
}))

// Mock next/cache
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Mock next/navigation
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

// Mock @/auth to return a client session
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: 'test-user-id',
      email: 'client@example.com',
      role: 'client',
      tenant_id: 'wolt',
      location_id: 'test-loc-id',
      sub: 'test-user-id',
    },
  }),
}))

// Mock @/lib/auth-guard
vi.mock('@/lib/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: {
      id: 'test-user-id',
      role: 'client',
      tenant_id: 'wolt',
      location_id: 'test-loc-id',
    },
  }),
}))

import { withRLSContext } from '@repo/db'

const PRODUCT_ID_1 = '00000000-0000-0000-0000-000000000001'
const PRODUCT_ID_2 = '00000000-0000-0000-0000-000000000002'
const LOCATION_ID = 'test-loc-id'

// Helpers to build FormData for pickup submission
function buildFormData(overrides: Record<string, string | string[]> = {}): FormData {
  const fd = new FormData()
  const defaults: Record<string, string | string[]> = {
    preferred_date: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
    pallet_count: '2',
    pallet_dimensions: '120x80x150cm',
    notes: 'Test notes',
    [`lines[0][product_id]`]: PRODUCT_ID_1,
    [`lines[0][quantity]`]: '5',
    [`lines[1][product_id]`]: PRODUCT_ID_2,
    [`lines[1][quantity]`]: '0',
  }
  const merged = { ...defaults, ...overrides }
  for (const [k, v] of Object.entries(merged)) {
    if (Array.isArray(v)) {
      for (const item of v) fd.append(k, item)
    } else {
      fd.set(k, v)
    }
  }
  return fd
}

// Default mock tx used by most tests
function buildMockTx(productRows = [
  { id: PRODUCT_ID_1, weight_grams: '500.00' },
  { id: PRODUCT_ID_2, weight_grams: '300.00' },
], locationRow = { id: LOCATION_ID, name: 'Copenhagen HQ', address: '123 Main St', tenant_id: 'wolt' }) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([locationRow]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'pickup-uuid-1', reference: 'PU-2026-0001' }]),
      }),
    }),
  }
}

describe('submitPickupRequest (PICKUP-01, PICKUP-03, PICKUP-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('Test 1: rejects preferred_date within 72 hours', async () => {
    const fd = buildFormData({
      preferred_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
    })

    const { submitPickupRequest } = await import('./actions')
    const result = await submitPickupRequest(fd)

    expect(result).toEqual({ error: 'Preferred date must be at least 72 hours from now' })
  })

  it('Test 2: accepts preferred_date 96 hours from now (no 72h error)', async () => {
    // Set up withRLSContext to run callbacks sequentially:
    // call 1: fetch location; call 2: fetch products; call 3: insert pickup; call 4: insert lines; call 5: select reference
    let callCount = 0
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      callCount++
      if (callCount === 1) {
        // fetch location
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: LOCATION_ID, name: 'HQ', address: '123 St', tenant_id: 'wolt' }]),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 2) {
        // fetch products for weight calculation
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: PRODUCT_ID_1, weight_grams: '500.00' },
                { id: PRODUCT_ID_2, weight_grams: '300.00' },
              ]),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 3) {
        // insert pickup
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'pickup-uuid-1' }]),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 4) {
        // insert pickup lines
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 5) {
        // select back reference
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ reference: 'PU-2026-0001' }]),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }
      return undefined
    })

    const fd = buildFormData({
      preferred_date: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
    })

    const { submitPickupRequest } = await import('./actions')
    const result = await submitPickupRequest(fd)

    // Should NOT return a 72h error
    expect(result).not.toEqual({ error: 'Preferred date must be at least 72 hours from now' })
  })

  it('Test 3: rejects when all product quantities are zero', async () => {
    const fd = buildFormData({
      preferred_date: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
      [`lines[0][product_id]`]: PRODUCT_ID_1,
      [`lines[0][quantity]`]: '0',
      [`lines[1][product_id]`]: PRODUCT_ID_2,
      [`lines[1][quantity]`]: '0',
    })

    const { submitPickupRequest } = await import('./actions')
    const result = await submitPickupRequest(fd)

    expect(result).toEqual({ error: 'At least one product must have a quantity greater than zero' })
  })

  it('Test 5: sends confirmation email on successful submission', async () => {
    let callCount = 0
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      callCount++
      if (callCount === 1) {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: LOCATION_ID, name: 'Copenhagen HQ', address: '123 St', tenant_id: 'wolt' }]),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 2) {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: PRODUCT_ID_1, weight_grams: '500.00' },
              ]),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 3) {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'pickup-uuid-1' }]),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 4) {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 5) {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ reference: 'PU-2026-0001' }]),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 6) {
        // in-app notification insert
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        }
        return fn(tx as never)
      }
      return undefined
    })

    const { sendEmail } = await import('@/lib/email')
    const fd = buildFormData({
      preferred_date: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
    })

    const { submitPickupRequest } = await import('./actions')
    await submitPickupRequest(fd)

    // sendEmail should have been called with the client's email for confirmation
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        subject: expect.stringContaining('Pickup Request Confirmed'),
      })
    )
  })

  it('Test 4: estimated_weight_grams = SUM(product.weight_grams * quantity) + (pallet_count * 25000)', async () => {
    // products: PRODUCT_ID_1 weight=500, qty=5 => 2500
    //           PRODUCT_ID_2 weight=300, qty=3 => 900
    // pallet_count=2 => 2*25000=50000
    // total = 53400
    let callCount = 0
    let capturedInsertValues: Record<string, unknown> | null = null

    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      callCount++
      if (callCount === 1) {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: LOCATION_ID, name: 'HQ', address: '123 St', tenant_id: 'wolt' }]),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 2) {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { id: PRODUCT_ID_1, weight_grams: '500.00' },
                { id: PRODUCT_ID_2, weight_grams: '300.00' },
              ]),
            }),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 3) {
        const insertFn = vi.fn().mockImplementation((values) => {
          capturedInsertValues = values
          return { returning: vi.fn().mockResolvedValue([{ id: 'pickup-uuid-1' }]) }
        })
        const tx = {
          insert: vi.fn().mockReturnValue({ values: insertFn }),
        }
        return fn(tx as never)
      }
      if (callCount === 4) {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        }
        return fn(tx as never)
      }
      if (callCount === 5) {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ reference: 'PU-2026-0001' }]),
              }),
            }),
          }),
        }
        return fn(tx as never)
      }
      return undefined
    })

    const fd = buildFormData({
      preferred_date: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
      pallet_count: '2',
      [`lines[0][product_id]`]: PRODUCT_ID_1,
      [`lines[0][quantity]`]: '5',
      [`lines[1][product_id]`]: PRODUCT_ID_2,
      [`lines[1][quantity]`]: '3',
    })

    const { submitPickupRequest } = await import('./actions')
    const result = await submitPickupRequest(fd)

    // 500*5 + 300*3 + 2*25000 = 2500 + 900 + 50000 = 53400
    expect(capturedInsertValues).not.toBeNull()
    expect((capturedInsertValues as unknown as Record<string, unknown>)?.['estimated_weight_grams']).toBe('53400.00')
    expect(result).toEqual({ success: true, reference: 'PU-2026-0001', pickupId: 'pickup-uuid-1' })
  })
})

const PICKUP_ID = '00000000-0000-0000-0000-000000000010'

describe('cancelPickupAsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('Test 1 (24h rule — cancel allowed): returns success when confirmed_date is 48h from now', async () => {
    const confirmedDate = new Date(Date.now() + 48 * 60 * 60 * 1000)

    let callCount = 0
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      callCount++
      if (callCount === 1) {
        // Fetch pickup
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { id: PICKUP_ID, status: 'confirmed', confirmed_date: confirmedDate },
                ]),
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

    const { cancelPickupAsClient } = await import('./actions')
    const result = await cancelPickupAsClient(PICKUP_ID)

    expect(result).toEqual({ success: true })
  })

  it('Test 2 (24h rule — cancel blocked): returns error when confirmed_date is 12h from now', async () => {
    const confirmedDate = new Date(Date.now() + 12 * 60 * 60 * 1000)

    vi.mocked(withRLSContext).mockImplementationOnce(async (_claims, fn) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: PICKUP_ID, status: 'confirmed', confirmed_date: confirmedDate },
              ]),
            }),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { cancelPickupAsClient } = await import('./actions')
    const result = await cancelPickupAsClient(PICKUP_ID)

    expect(result).toEqual({
      error: 'Cannot cancel within 24 hours of confirmed pickup date',
    })
  })

  it('Test 3 (cancel unconfirmed): returns success when status is submitted with no confirmed_date', async () => {
    let callCount = 0
    vi.mocked(withRLSContext).mockImplementation(async (_claims, fn) => {
      callCount++
      if (callCount === 1) {
        // Fetch pickup — submitted, no confirmed_date
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { id: PICKUP_ID, status: 'submitted', confirmed_date: null },
                ]),
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

    const { cancelPickupAsClient } = await import('./actions')
    const result = await cancelPickupAsClient(PICKUP_ID)

    expect(result).toEqual({ success: true })
  })

  it('Test 4 (cancel terminal status): returns error when status is delivered', async () => {
    vi.mocked(withRLSContext).mockImplementationOnce(async (_claims, fn) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: PICKUP_ID, status: 'delivered', confirmed_date: null },
              ]),
            }),
          }),
        }),
      }
      return fn(tx as never)
    })

    const { cancelPickupAsClient } = await import('./actions')
    const result = await cancelPickupAsClient(PICKUP_ID)

    expect(result).toEqual({ error: 'Cannot cancel a pickup in terminal status' })
  })
})
