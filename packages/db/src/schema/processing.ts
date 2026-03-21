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

// Enums (PROCESS-02)
export const activityTypeEnum = pgEnum('activity_type', ['wash', 'pack'])

// size_bucket is defined here and reusable by dispatch schema (PROCESS-02, DISPATCH)
export const sizeBucketEnum = pgEnum('size_bucket', [
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  'XXL',
  'XXXL',
])

// Processing reports — one per wash or pack session at a prison facility (PROCESS-02)
// voided records are kept for audit trail; void_reason required if voided
export const processingReports = pgTable(
  'processing_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    prison_facility_id: uuid('prison_facility_id')
      .notNull()
      .references(() => prisonFacilities.id),
    intake_record_id: uuid('intake_record_id').references(
      () => intakeRecords.id
    ), // nullable — processing can be unlinked from a specific intake
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    staff_name: text('staff_name').notNull(),
    activity_type: activityTypeEnum('activity_type').notNull(),
    product_id: uuid('product_id')
      .notNull()
      .references(() => products.id),
    report_date: timestamp('report_date').notNull(),
    notes: text('notes'), // nullable
    voided: boolean('voided').notNull().default(false),
    void_reason: text('void_reason'), // nullable — required when voided=true (enforced in application)
    submitted_by: uuid('submitted_by').references(() => users.id), // nullable
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
    is_imported: boolean('is_imported').notNull().default(false),
  },
  (t) => [
    index('processing_reports_tenant_id_idx').on(t.tenant_id),
    index('processing_reports_prison_facility_id_idx').on(t.prison_facility_id),
    index('processing_reports_intake_record_id_idx').on(t.intake_record_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('processing_reports_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // prison role SELECT: own facility only
    pgPolicy('processing_reports_prison_select', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
    }),
    // prison role INSERT: own facility only
    pgPolicy('processing_reports_prison_insert', {
      as: 'permissive',
      to: prisonRole,
      for: 'insert',
      withCheck: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
    }),
    // prison role UPDATE: own facility only — enables voiding records (AUDIT-04)
    pgPolicy('processing_reports_prison_update', {
      as: 'permissive',
      to: prisonRole,
      for: 'update',
      using: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
      withCheck: sql`prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
    }),
    // reco: SELECT only
    pgPolicy('processing_reports_reco_select', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // reco-admin: full CRUD
    pgPolicy('processing_reports_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ]
)

// Processing report lines — one row per size bucket (clothing) or single total (bag/equipment)
// size_bucket is nullable: null means non-clothing total quantity (bag, equipment, other)
export const processingReportLines = pgTable(
  'processing_report_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    processing_report_id: uuid('processing_report_id')
      .notNull()
      .references(() => processingReports.id, { onDelete: 'cascade' }),
    size_bucket: sizeBucketEnum('size_bucket'), // nullable — null means bag/non-clothing total
    quantity: integer('quantity').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('processing_report_lines_report_id_idx').on(t.processing_report_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('processing_report_lines_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // prison role SELECT via EXISTS subquery on parent processing_reports
    pgPolicy('processing_report_lines_prison_select', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`EXISTS (
        SELECT 1 FROM processing_reports
        WHERE processing_reports.id = processing_report_lines.processing_report_id
          AND processing_reports.prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)
      )`,
    }),
    // reco: SELECT only
    pgPolicy('processing_report_lines_reco_select', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // reco-admin: full CRUD
    pgPolicy('processing_report_lines_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ]
)
