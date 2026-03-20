// Wolt Product Pre-Load (PROD-07)
// Source: PRD §4.10 — all weights, materials, and pricing verified from source
// Idempotent: uses onConflictDoNothing for material library inserts; insert-then-select
//             pattern for products (handles Pitfall 6: onConflictDoNothing().returning()
//             returns empty array on conflict)
// Run: pnpm --filter db seed:wolt

import { and, eq } from 'drizzle-orm'
import { db } from './db'
import {
  materialLibrary,
  productMaterials,
  productPricing,
  products,
  tenants,
} from './schema'

const WOLT_TENANT_ID = 'wolt'
const EFFECTIVE_FROM = new Date('2020-01-01')

// ─── Unique materials across all 5 Wolt products ───────────────────────────
// Bike Bag: Polypropylene, PVC, PE+Aluminium, Polyester, Foam, Remains,
//           Cotton-polyester, Zipper Metal, POM, Metal Screws, Copper, Nylon
// Car Bag:  Polyester (shared), Foam (shared), Aluminum/Foam, Remains (shared), POM (shared)
// Inner Bag: Polyester (shared), Aluminum/Foam (shared), Remains (shared)
// Heating Plate: Mica Plate, Polypropylene (shared), Aluminum, El, Polyester (shared), Foam (shared)
// Clothing: No material composition (weight unknown per PRD)
// Total unique: 16
const MATERIAL_NAMES = [
  'Polypropylene',
  'PVC',
  'PE+Aluminium',
  'Polyester',
  'Foam',
  'Remains',
  'Cotton-polyester',
  'Zipper Metal',
  'POM',
  'Metal Screws',
  'Copper',
  'Nylon',
  'Aluminum/Foam',
  'Mica Plate',
  'Aluminum',
  'El',
] as const

export async function seedWoltProducts() {
  // ─── Step 0: Ensure Wolt tenant exists ─────────────────────────────────
  await db
    .insert(tenants)
    .values({ id: WOLT_TENANT_ID, name: 'Wolt', active: true })
    .onConflictDoNothing()

  // ─── Step 1: Seed global material library ──────────────────────────────
  await db
    .insert(materialLibrary)
    .values(MATERIAL_NAMES.map((name) => ({ name })))
    .onConflictDoNothing() // unique on name — safe to run multiple times

  // ─── Step 2: Build material name → UUID map ────────────────────────────
  const allMaterials = await db.select().from(materialLibrary)
  const matId = (name: string): string => {
    const m = allMaterials.find((m) => m.name === name)
    if (!m) throw new Error(`Material not found in library: "${name}"`)
    return m.id
  }

  // ─── Step 3: Seed products (insert-then-select for idempotency) ─────────
  // Pitfall 6: onConflictDoNothing().returning() returns [] on conflict.
  // Pattern: insert with onConflictDoNothing, then SELECT by (tenant_id, product_code).

  type ProductSeed = {
    tenant_id: string
    name: string
    product_code: string
    product_group: string
    processing_stream: 'recycling' | 'reuse'
    weight_grams: string | null
    active: boolean
  }

  const productSeeds: ProductSeed[] = [
    {
      tenant_id: WOLT_TENANT_ID,
      name: 'Bike Bag',
      product_code: 'WLT-BB-001',
      product_group: 'Bike Bag',
      processing_stream: 'recycling',
      weight_grams: '2680',
      active: true,
    },
    {
      tenant_id: WOLT_TENANT_ID,
      name: 'Car Bag',
      product_code: 'WLT-CB-001',
      product_group: 'Car Bag',
      processing_stream: 'recycling',
      weight_grams: '918',
      active: true,
    },
    {
      tenant_id: WOLT_TENANT_ID,
      name: 'Inner Bag',
      product_code: 'WLT-IB-001',
      product_group: 'Inner Bag',
      processing_stream: 'recycling',
      weight_grams: '324',
      active: true,
    },
    {
      tenant_id: WOLT_TENANT_ID,
      name: 'Heating Plate',
      product_code: 'WLT-HP-001',
      product_group: 'Heating Plate',
      processing_stream: 'recycling',
      weight_grams: '703',
      active: true,
    },
    {
      tenant_id: WOLT_TENANT_ID,
      name: 'Clothing (PreLoved)',
      product_code: 'WLT-CL-001',
      product_group: 'Clothing',
      processing_stream: 'reuse',
      weight_grams: null, // TODO: weight unknown per PRD §4.10 — confirm with reco/Wolt
      active: true,
    },
  ]

  await db.insert(products).values(productSeeds).onConflictDoNothing()

  // Select all 5 products by code to get their UUIDs
  const woltProducts = await db
    .select()
    .from(products)
    .where(eq(products.tenant_id, WOLT_TENANT_ID))

  const prod = (code: string) => {
    const p = woltProducts.find((p) => p.product_code === code)
    if (!p) throw new Error(`Product not found after insert: "${code}"`)
    return p
  }

  const bikeBag = prod('WLT-BB-001')
  const carBag = prod('WLT-CB-001')
  const innerBag = prod('WLT-IB-001')
  const heatingPlate = prod('WLT-HP-001')
  const clothing = prod('WLT-CL-001')

  // ─── Step 4: Seed material composition lines ────────────────────────────
  // Idempotency: check if product already has composition lines before inserting.
  // product_materials has no unique constraint, so onConflictDoNothing cannot be used.

  type MaterialLine = {
    product_id: string
    material_library_id: string
    weight_grams: string
    effective_from: Date
    effective_to: null
  }

  async function seedComposition(productId: string, lines: Omit<MaterialLine, 'product_id' | 'effective_from' | 'effective_to'>[]) {
    const existing = await db
      .select({ id: productMaterials.id })
      .from(productMaterials)
      .where(eq(productMaterials.product_id, productId))

    if (existing.length === 0) {
      await db.insert(productMaterials).values(
        lines.map((line) => ({
          ...line,
          product_id: productId,
          effective_from: EFFECTIVE_FROM,
          effective_to: null,
        }))
      )
    }
  }

  // Bike Bag — 12 material lines
  await seedComposition(bikeBag.id, [
    { material_library_id: matId('Polypropylene'),   weight_grams: '943' },
    { material_library_id: matId('PVC'),             weight_grams: '386' },
    { material_library_id: matId('PE+Aluminium'),    weight_grams: '296' },
    { material_library_id: matId('Polyester'),       weight_grams: '294' },
    { material_library_id: matId('Foam'),            weight_grams: '292' },
    { material_library_id: matId('Remains'),         weight_grams: '260' },
    { material_library_id: matId('Cotton-polyester'),weight_grams: '98'  },
    { material_library_id: matId('Zipper Metal'),    weight_grams: '54'  },
    { material_library_id: matId('POM'),             weight_grams: '37'  },
    { material_library_id: matId('Metal Screws'),    weight_grams: '15'  },
    { material_library_id: matId('Copper'),          weight_grams: '4'   },
    { material_library_id: matId('Nylon'),           weight_grams: '1'   },
  ])

  // Car Bag — 5 material lines
  await seedComposition(carBag.id, [
    { material_library_id: matId('Polyester'),    weight_grams: '555' },
    { material_library_id: matId('Foam'),         weight_grams: '187' },
    { material_library_id: matId('Aluminum/Foam'),weight_grams: '90'  },
    { material_library_id: matId('Remains'),      weight_grams: '80'  },
    { material_library_id: matId('POM'),          weight_grams: '6'   },
  ])

  // Inner Bag — 3 material lines
  await seedComposition(innerBag.id, [
    { material_library_id: matId('Polyester'),    weight_grams: '237' },
    { material_library_id: matId('Aluminum/Foam'),weight_grams: '62'  },
    { material_library_id: matId('Remains'),      weight_grams: '25'  },
  ])

  // Heating Plate — 6 material lines
  await seedComposition(heatingPlate.id, [
    { material_library_id: matId('Mica Plate'),    weight_grams: '181' },
    { material_library_id: matId('Polypropylene'), weight_grams: '156' },
    { material_library_id: matId('Aluminum'),      weight_grams: '150' },
    { material_library_id: matId('El'),            weight_grams: '146' },
    { material_library_id: matId('Polyester'),     weight_grams: '44'  },
    { material_library_id: matId('Foam'),          weight_grams: '26'  },
  ])

  // Clothing — NO material composition (weight and materials unknown per PRD §4.10)
  // TODO: confirm material composition with reco/Wolt when data becomes available

  // ─── Step 5: Seed pricing records ──────────────────────────────────────
  // Pricing data from PRD §4.10 (effective from deployment date, effective_to = null)
  // Idempotency: check if product already has pricing before inserting.

  type PricingLine = {
    product_id: string
    price_eur: string | null
    price_dkk: string | null
    effective_from: Date
    effective_to: null
  }

  async function seedPricing(productId: string, price_eur: string | null, price_dkk: string | null) {
    const existing = await db
      .select({ id: productPricing.id })
      .from(productPricing)
      .where(eq(productPricing.product_id, productId))

    if (existing.length === 0) {
      const line: PricingLine = {
        product_id: productId,
        price_eur,
        price_dkk,
        effective_from: EFFECTIVE_FROM,
        effective_to: null,
      }
      await db.insert(productPricing).values(line)
    }
  }

  await seedPricing(bikeBag.id,      '4.2900', null)
  await seedPricing(carBag.id,       '4.1400', null)
  await seedPricing(innerBag.id,     '4.0900', null)
  await seedPricing(heatingPlate.id, '2.9900', null)
  await seedPricing(clothing.id,     null,     '35.0000')
}

seedWoltProducts()
  .then(() => {
    console.log('Wolt seed complete')
    process.exit(0)
  })
  .catch((e) => {
    console.error('Wolt seed failed:', e)
    process.exit(1)
  })
