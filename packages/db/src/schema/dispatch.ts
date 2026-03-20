import {
  boolean,
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, recoRole, prisonRole } from './auth'
import { users } from './auth'
import { tenants } from './tenants'
import { prisonFacilities } from './tenants'
import { intakeRecords } from './intake'
import { products } from './products'
import { sizeBucketEnum } from './processing'

// Dispatch status lifecycle: created → picked_up → delivered (DISPATCH-01)
export const dispatchStatusEnum = pgEnum('dispatch_status', [
  'created',
  'picked_up',
  'delivered',
])

// Outbound dispatch records — clothing shipments from prison to redistribution partner (DISPATCH-01, DISPATCH-02)
// intake_record_id: optional FK for deterministic traceability chain linking (PROCESS-05)
// when null, dispatch covers multiple intakes or is created independently (facility-level fallback)
export const outboundDispatches = pgTable(
  'outbound_dispatches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prison_facility_id: uuid('prison_facility_id')
      .notNull()
      .references(() => prisonFacilities.id),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    intake_record_id: uuid('intake_record_id').references(
      () => intakeRecords.id
    ), // nullable — optional FK for deterministic traceability; null when dispatch covers multiple intakes or created independently
    dispatch_date: timestamp('dispatch_date').notNull(),
    destination: text('destination').notNull(),
    carrier: text('carrier'), // nullable
    notes: text('notes'), // nullable
    status: dispatchStatusEnum('status').notNull().default('created'),
    voided: boolean('voided').notNull().default(false),
    void_reason: text('void_reason'), // nullable
    created_by: uuid('created_by').references(() => users.id), // nullable
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('outbound_dispatches_tenant_id_idx').on(t.tenant_id),
    index('outbound_dispatches_prison_facility_id_idx').on(t.prison_facility_id),
    index('outbound_dispatches_intake_record_id_idx').on(t.intake_record_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('outbound_dispatches_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // prison role SELECT: own facility only (DISPATCH-04: view only — no INSERT/UPDATE)
    pgPolicy('outbound_dispatches_prison_select', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
    }),
    // reco: SELECT only
    pgPolicy('outbound_dispatches_reco_select', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // reco-admin: full CRUD
    pgPolicy('outbound_dispatches_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ]
)

// Outbound dispatch lines — packing list items (DISPATCH-02, DISPATCH-03)
// size_bucket: nullable — null for non-clothing items (bags, equipment)
// sku_code: nullable — assigned SKU for redistribution partner tracking
export const outboundDispatchLines = pgTable(
  'outbound_dispatch_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outbound_dispatch_id: uuid('outbound_dispatch_id')
      .notNull()
      .references(() => outboundDispatches.id, { onDelete: 'cascade' }),
    product_id: uuid('product_id')
      .notNull()
      .references(() => products.id),
    size_bucket: sizeBucketEnum('size_bucket'), // nullable — null for non-clothing totals
    sku_code: text('sku_code'), // nullable — SKU code for redistribution partner
    quantity: integer('quantity').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('outbound_dispatch_lines_dispatch_id_idx').on(t.outbound_dispatch_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('outbound_dispatch_lines_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // prison role SELECT via EXISTS subquery on parent outbound_dispatches
    pgPolicy('outbound_dispatch_lines_prison_select', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`EXISTS (
        SELECT 1 FROM outbound_dispatches od
        WHERE od.id = outbound_dispatch_lines.outbound_dispatch_id
          AND od.prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)
      )`,
    }),
    // reco: SELECT only
    pgPolicy('outbound_dispatch_lines_reco_select', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // reco-admin: full CRUD
    pgPolicy('outbound_dispatch_lines_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ]
)
