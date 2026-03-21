import {
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole } from './auth'
import { users } from './auth'
import { tenants } from './tenants'

// Import jobs — tracks parsed rows and validation errors for preview-then-commit workflow (IMPORT-01, IMPORT-02)
// RLS: reco-admin only
export const importJobs = pgTable(
  'import_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: text('source').notNull(), // 'pickup_log' | 'intake_log' | 'greenloop' | 'invoice_binder' | 'transport_costs'
    target_tenant_id: text('target_tenant_id')
      .notNull()
      .references(() => tenants.id),
    status: text('status').notNull().default('pending'), // 'pending' | 'ready' | 'has_errors' | 'committed'
    file_name: text('file_name').notNull().default(''),
    total_rows: integer('total_rows').notNull().default(0),
    valid_rows: integer('valid_rows').notNull().default(0),
    error_count: integer('error_count').notNull().default(0),
    rows_json: text('rows_json').notNull().default('[]'),
    errors_json: text('errors_json').notNull().default('[]'),
    column_mapping_json: text('column_mapping_json'), // nullable — stores user's column-to-field mapping
    created_by: uuid('created_by').references(() => users.id), // nullable
    committed_at: timestamp('committed_at'), // nullable
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  () => [
    // RLS: reco-admin only
    pgPolicy('import_jobs_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ]
)
