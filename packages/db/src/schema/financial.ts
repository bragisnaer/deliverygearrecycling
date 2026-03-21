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
import { recoAdminRole, recoRole } from './auth'
import { tenants } from './tenants'
import { intakeRecords } from './intake'

// Invoice lifecycle status (FIN-01)
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'not_invoiced',
  'invoiced',
  'paid',
])

// Financial records — one per intake_record (1:1, auto-created by trigger) (FIN-01, FIN-02)
// RLS: fail-closed for client, transport, and prison roles (FIN-06)
export const financialRecords = pgTable(
  'financial_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    intake_record_id: uuid('intake_record_id')
      .notNull()
      .unique()
      .references(() => intakeRecords.id),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id),
    transport_cost_eur: numeric('transport_cost_eur', {
      precision: 12,
      scale: 4,
    }), // nullable
    estimated_invoice_amount_eur: numeric('estimated_invoice_amount_eur', {
      precision: 12,
      scale: 4,
    }), // nullable
    invoice_status: invoiceStatusEnum('invoice_status')
      .notNull()
      .default('not_invoiced'),
    invoice_number: text('invoice_number'), // nullable
    invoice_date: timestamp('invoice_date'), // nullable
    notes: text('notes'), // nullable
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
    is_imported: boolean('is_imported').notNull().default(false),
  },
  (t) => [
    index('financial_records_intake_record_id_idx').on(t.intake_record_id),
    index('financial_records_tenant_id_idx').on(t.tenant_id),
    index('financial_records_invoice_status_idx').on(t.invoice_status),
    // Default deny: restrictive USING(false) — fail-closed for all roles (FIN-06)
    pgPolicy('financial_records_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('financial_records_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only when can_view_financials is true (FIN-06, AUTH-08)
    pgPolicy('financial_records_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`EXISTS (SELECT 1 FROM users u WHERE u.id::text = current_setting('request.jwt.claim.sub', true) AND u.can_view_financials = true)`,
    }),
    // No policies for clientRole, transportRole, prisonRole — fail-closed (FIN-06)
  ]
)
