import {
  check,
  integer,
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, recoRole } from './auth'
import { users } from './auth'

// Singleton system settings table (SETTINGS-01)
// Enforces single row via CHECK (id = 1)
export const systemSettings = pgTable(
  'system_settings',
  {
    id: integer('id').primaryKey().default(1),
    exchange_rate_eur_dkk: numeric('exchange_rate_eur_dkk', {
      precision: 10,
      scale: 4,
    })
      .notNull()
      .default('7.4600'),
    warehouse_ageing_threshold_days: integer('warehouse_ageing_threshold_days')
      .notNull()
      .default(14),
    discrepancy_alert_threshold_pct: integer('discrepancy_alert_threshold_pct')
      .notNull()
      .default(15),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
    updated_by: uuid('updated_by').references(() => users.id),
  },
  (t) => [
    // Enforce singleton row
    check('system_settings_single_row', sql`${t.id} = 1`),
    // Default deny: restrictive USING(false)
    pgPolicy('system_settings_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('system_settings_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('system_settings_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
  ]
)
