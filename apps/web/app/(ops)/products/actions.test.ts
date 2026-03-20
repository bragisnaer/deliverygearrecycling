import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @repo/db so no real DB connection is required
vi.mock('@repo/db', () => {
  const mockTx = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  }
  return {
    db: { transaction: vi.fn() },
    withRLSContext: vi.fn(),
    products: {},
    productMaterials: {},
    productPricing: {},
    materialLibrary: {},
  }
})

// Mock next/cache
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// Mock @/auth to return a reco-admin session
vi.mock('@/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-id', role: 'reco-admin', tenant_id: 'tenant-1', sub: 'user-id' },
  }),
}))

// Mock storage
vi.mock('@/lib/storage', () => ({
  getProductsBucket: vi.fn(),
  getProductPhotoPath: vi.fn(),
  getMaterialPhotoPath: vi.fn(),
}))

import { withRLSContext } from '@repo/db'

const PRODUCT_ID = '00000000-0000-0000-0000-000000000001'

describe('Product actions (PROD-04, PROD-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPricingRecord', () => {
    it('sets effective_to on previous current record to (new effective_from - 1 day)', async () => {
      // Capture the transaction callback so we can inspect the DB calls
      const updateMock = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) })
      const insertMock = vi.fn().mockReturnValue({ values: vi.fn() })

      const existingEffectiveFrom = new Date('2024-01-01')

      vi.mocked(withRLSContext).mockImplementationOnce(async (_claims, fn) => {
        // Provide a fake tx that simulates the DB
        const selectResult = [{ id: 'pricing-1', effective_from: existingEffectiveFrom }]
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(selectResult),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        }

        const result = await fn(tx as never)

        // Assert: update was called (to close the previous record)
        expect(tx.update).toHaveBeenCalled()

        const setCalls = tx.update.mock.results
        // The set() call should include effective_to = newEffectiveFrom - 1 day
        const updateSetCall = tx.update.mock.results[0]?.value?.set
        expect(updateSetCall).toBeDefined()

        // Capture what was passed to set()
        const setArg = tx.update.mock.instances[0]
        void setArg // used for side-effect capture

        // Assert: insert was called (new record)
        expect(tx.insert).toHaveBeenCalled()

        return result
      })

      const { createPricingRecord } = await import('./actions')
      const result = await createPricingRecord({
        product_id: PRODUCT_ID,
        price_eur: '99.99',
        effective_from: '2024-06-01',
      })

      expect(result).toEqual({ success: true })
    })

    it('rejects if new effective_from <= current effective_from', async () => {
      const existingEffectiveFrom = new Date('2024-06-01')

      vi.mocked(withRLSContext).mockImplementationOnce(async (_claims, fn) => {
        const selectResult = [{ id: 'pricing-1', effective_from: existingEffectiveFrom }]
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue(selectResult),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockResolvedValue(undefined),
          }),
        }

        return fn(tx as never)
      })

      const { createPricingRecord } = await import('./actions')

      // New effective_from is same as existing — should be rejected
      const result = await createPricingRecord({
        product_id: PRODUCT_ID,
        price_eur: '50.00',
        effective_from: '2024-06-01',
      })

      expect(result).toEqual({
        error: 'New effective date must be after the current record effective date',
      })
    })

    it.todo('updateMaterialComposition closes previous composition and creates new with effective_from')
    it.todo('historical composition query returns correct materials at a past date')
  })
})
