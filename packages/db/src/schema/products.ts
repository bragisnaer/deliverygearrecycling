import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, recoRole, clientRole } from './auth'
import { tenants } from './tenants'
import { materialLibrary } from './materials'

// Enums (PROD-03, PROD-05)
export const processingStreamEnum = pgEnum('processing_stream', [
  'recycling',
  'reuse',
])

export const recyclingOutcomeEnum = pgEnum('recycling_outcome', [
  'recycled',
  'reprocessed',
  'incinerated',
  'landfill',
])

// Core product registry table (PROD-01, PROD-08)
// product_code uniqueness is per-tenant — enforced by partial unique index in migration SQL
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    product_code: text('product_code').notNull(), // unique per tenant via DB index
    product_group: text('product_group'), // nullable — groups product versions (e.g. "Bike Bag")
    processing_stream: processingStreamEnum('processing_stream').notNull(),
    description: text('description'), // nullable
    weight_grams: numeric('weight_grams', { precision: 10, scale: 2 }), // nullable — Clothing has unknown weight
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('products_tenant_id_idx').on(t.tenant_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('products_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('products_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('products_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // client: SELECT WHERE tenant_id matches JWT claim
    pgPolicy('products_client_read', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
  ]
)

// Effective-dated product material composition (PROD-03, PROD-04)
// Tenant-scoped via product join (no direct tenant_id column)
export const productMaterials = pgTable(
  'product_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product_id: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    material_library_id: uuid('material_library_id')
      .notNull()
      .references(() => materialLibrary.id), // no cascade — material library entries should not be deleted
    weight_grams: numeric('weight_grams', { precision: 10, scale: 2 }).notNull(),
    recycling_cost_per_kg_eur: numeric('recycling_cost_per_kg_eur', {
      precision: 10,
      scale: 4,
    }), // nullable
    recycling_cost_per_kg_dkk: numeric('recycling_cost_per_kg_dkk', {
      precision: 10,
      scale: 4,
    }), // nullable
    recycling_outcome: recyclingOutcomeEnum('recycling_outcome'), // nullable
    disassembly_photo_paths: text('disassembly_photo_paths').array(), // nullable — up to 2 storage paths
    effective_from: timestamp('effective_from').notNull().defaultNow(),
    effective_to: timestamp('effective_to'), // nullable — null means current
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('product_materials_product_id_idx').on(t.product_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('product_materials_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('product_materials_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('product_materials_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // client: SELECT WHERE parent product belongs to their tenant (via EXISTS subquery)
    pgPolicy('product_materials_client_read', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`EXISTS (SELECT 1 FROM products p WHERE p.id = product_id AND p.tenant_id = current_setting('request.jwt.claim.tenant_id', true))`,
    }),
  ]
)

// Effective-dated product pricing — reco-admin only, no client access (PROD-05)
// Sensitive master data; clients are never shown pricing directly
export const productPricing = pgTable(
  'product_pricing',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    product_id: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    price_eur: numeric('price_eur', { precision: 10, scale: 4 }), // nullable — Clothing uses DKK only
    price_dkk: numeric('price_dkk', { precision: 10, scale: 4 }), // nullable — most products use EUR only
    effective_from: timestamp('effective_from').notNull(),
    effective_to: timestamp('effective_to'), // nullable — null means current
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('product_pricing_product_id_idx').on(t.product_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('product_pricing_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('product_pricing_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('product_pricing_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // NO client access to pricing (sensitive master data)
  ]
)
