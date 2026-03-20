import { describe, it, expect, beforeAll } from 'vitest'
import { and, eq, isNull } from 'drizzle-orm'
import { testDb } from './setup'
import { products, productMaterials, productPricing, materialLibrary } from '../schema'
import { seedWoltProducts } from '../seed-wolt'

describe('Wolt seed data (PROD-07)', () => {
  // Run seed before tests — idempotent, so safe to run even if already seeded
  beforeAll(async () => {
    await seedWoltProducts()
  }, 30000)

  it('5 Wolt products exist after seed', async () => {
    const result = await testDb.select().from(products).where(eq(products.tenant_id, 'wolt'))
    expect(result).toHaveLength(5)
  })

  it('Bike Bag weight is 2680 grams', async () => {
    const [bikeBag] = await testDb
      .select()
      .from(products)
      .where(and(eq(products.tenant_id, 'wolt'), eq(products.product_code, 'WLT-BB-001')))
    expect(bikeBag).toBeDefined()
    expect(bikeBag.name).toBe('Bike Bag')
    expect(parseFloat(bikeBag.weight_grams!)).toBe(2680)
  })

  it('Bike Bag has 12 material composition lines', async () => {
    const [bikeBag] = await testDb
      .select()
      .from(products)
      .where(and(eq(products.tenant_id, 'wolt'), eq(products.product_code, 'WLT-BB-001')))
    const composition = await testDb
      .select()
      .from(productMaterials)
      .where(and(eq(productMaterials.product_id, bikeBag.id), isNull(productMaterials.effective_to)))
    expect(composition).toHaveLength(12)
  })

  it('All 5 products have at least one pricing record', async () => {
    const woltProducts = await testDb
      .select()
      .from(products)
      .where(eq(products.tenant_id, 'wolt'))

    for (const product of woltProducts) {
      const pricing = await testDb
        .select()
        .from(productPricing)
        .where(
          and(eq(productPricing.product_id, product.id), isNull(productPricing.effective_to))
        )
      expect(pricing.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('Bike Bag Polypropylene weight is 943g', async () => {
    const [bikeBag] = await testDb
      .select()
      .from(products)
      .where(and(eq(products.tenant_id, 'wolt'), eq(products.product_code, 'WLT-BB-001')))
    const composition = await testDb
      .select({
        weight: productMaterials.weight_grams,
        materialName: materialLibrary.name,
      })
      .from(productMaterials)
      .innerJoin(materialLibrary, eq(productMaterials.material_library_id, materialLibrary.id))
      .where(and(eq(productMaterials.product_id, bikeBag.id), isNull(productMaterials.effective_to)))
    const pp = composition.find((c) => c.materialName === 'Polypropylene')
    expect(pp).toBeDefined()
    expect(parseFloat(pp!.weight)).toBe(943)
  })

  it('Clothing product has reuse processing stream and no weight', async () => {
    const [clothing] = await testDb
      .select()
      .from(products)
      .where(and(eq(products.tenant_id, 'wolt'), eq(products.product_code, 'WLT-CL-001')))
    expect(clothing.processing_stream).toBe('reuse')
    expect(clothing.weight_grams).toBeNull()
  })

  it('Clothing pricing is DKK 35', async () => {
    const [clothing] = await testDb
      .select()
      .from(products)
      .where(and(eq(products.tenant_id, 'wolt'), eq(products.product_code, 'WLT-CL-001')))
    const [pricing] = await testDb
      .select()
      .from(productPricing)
      .where(and(eq(productPricing.product_id, clothing.id), isNull(productPricing.effective_to)))
    expect(pricing.price_eur).toBeNull()
    expect(parseFloat(pricing.price_dkk!)).toBe(35)
  })
})
