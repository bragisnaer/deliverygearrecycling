import {
  boolean,
  index,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, recoRole, clientRole, prisonRole } from './auth'
import { users } from './auth'
import { tenants } from './tenants'
import { prisonFacilities } from './tenants'
import { pickups } from './pickups'
import { outboundShipments } from './transport'
import { products } from './products'

// Intake records — one per delivery event at a prison facility (INTAKE-01, INTAKE-03)
// reference is auto-set to IN-YYYY-NNNN by DB trigger (set in migration)
export const intakeRecords = pgTable(
  'intake_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prison_facility_id: uuid('prison_facility_id')
      .notNull()
      .references(() => prisonFacilities.id),
    pickup_id: uuid('pickup_id').references(() => pickups.id), // nullable — null for unexpected deliveries
    outbound_shipment_id: uuid('outbound_shipment_id').references(
      () => outboundShipments.id
    ), // nullable — set for consolidation
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    staff_name: text('staff_name').notNull(),
    delivery_date: timestamp('delivery_date').notNull(),
    origin_market: text('origin_market'), // nullable
    is_unexpected: boolean('is_unexpected').notNull().default(false),
    discrepancy_flagged: boolean('discrepancy_flagged').notNull().default(false),
    quarantine_flagged: boolean('quarantine_flagged').notNull().default(false),
    quarantine_overridden: boolean('quarantine_overridden')
      .notNull()
      .default(false),
    quarantine_override_reason: text('quarantine_override_reason'), // nullable
    quarantine_overridden_by: uuid('quarantine_overridden_by').references(
      () => users.id
    ), // nullable
    quarantine_overridden_at: timestamp('quarantine_overridden_at'), // nullable
    voided: boolean('voided').notNull().default(false),
    void_reason: text('void_reason'), // nullable
    notes: text('notes'), // nullable
    reference: text('reference').notNull().default(''), // overwritten by trigger → IN-YYYY-NNNN
    delivered_at: timestamp('delivered_at').notNull().defaultNow(), // Phase 7 financial linking
    submitted_by: uuid('submitted_by').references(() => users.id), // nullable
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
    is_imported: boolean('is_imported').notNull().default(false),
  },
  (t) => [
    index('intake_records_tenant_id_idx').on(t.tenant_id),
    index('intake_records_prison_facility_id_idx').on(t.prison_facility_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('intake_records_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // prison role SELECT: own facility only
    pgPolicy('intake_records_prison_select', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
    }),
    // prison role INSERT: own facility only
    pgPolicy('intake_records_prison_insert', {
      as: 'permissive',
      to: prisonRole,
      for: 'insert',
      withCheck: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
    }),
    // client_role SELECT: own tenant's intake records
    pgPolicy('intake_records_client_select', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
    // reco: SELECT only
    pgPolicy('intake_records_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // reco-admin: full CRUD
    pgPolicy('intake_records_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // prison role UPDATE: own facility only — enables voiding records (AUDIT-04)
    pgPolicy('intake_records_prison_update', {
      as: 'permissive',
      to: prisonRole,
      for: 'update',
      using: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
      withCheck: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
    }),
  ]
)

// Intake line items — one row per product type counted during intake (INTAKE-03)
export const intakeLines = pgTable(
  'intake_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    intake_record_id: uuid('intake_record_id')
      .notNull()
      .references(() => intakeRecords.id, { onDelete: 'cascade' }),
    product_id: uuid('product_id')
      .notNull()
      .references(() => products.id),
    informed_quantity: integer('informed_quantity'), // nullable — from pickup_lines; null for unexpected
    actual_quantity: integer('actual_quantity').notNull(),
    batch_lot_number: text('batch_lot_number'), // nullable
    discrepancy_pct: numeric('discrepancy_pct', { precision: 8, scale: 2 }), // nullable
    quarantine_flagged: boolean('quarantine_flagged').notNull().default(false),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('intake_lines_intake_record_id_idx').on(t.intake_record_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('intake_lines_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // prison role SELECT via EXISTS subquery on parent intake_records
    pgPolicy('intake_lines_prison_select', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`EXISTS (
        SELECT 1 FROM intake_records ir
        WHERE ir.id = intake_lines.intake_record_id
          AND ir.prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)
      )`,
    }),
    // prison role INSERT via EXISTS check on parent
    pgPolicy('intake_lines_prison_insert', {
      as: 'permissive',
      to: prisonRole,
      for: 'insert',
      withCheck: sql`EXISTS (
        SELECT 1 FROM intake_records ir
        WHERE ir.id = intake_lines.intake_record_id
          AND ir.prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)
      )`,
    }),
    // reco: SELECT only
    pgPolicy('intake_lines_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // reco-admin: full CRUD
    pgPolicy('intake_lines_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ]
)

// Batch/lot flags — defective batch registry for quarantine checks (INTAKE-07)
export const batchFlags = pgTable(
  'batch_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batch_lot_number: text('batch_lot_number').notNull().unique(),
    reason: text('reason').notNull(),
    flagged_by: uuid('flagged_by').references(() => users.id), // nullable
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  () => [
    // prison role SELECT: permissive — prison needs to read flags for quarantine check
    pgPolicy('batch_flags_prison_select', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('batch_flags_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // reco-admin: full CRUD
    pgPolicy('batch_flags_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ]
)
