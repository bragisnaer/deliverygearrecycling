import {
  boolean,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, recoRole, clientRole } from './auth'
import { tenants } from './tenants'

// Client pickup locations — physical sites where gear is collected (PICKUP-02)
export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address').notNull(),
    country: text('country').notNull(), // ISO 3166-1 alpha-2, e.g. "DK", "FI"
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('locations_tenant_id_idx').on(t.tenant_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('locations_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('locations_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('locations_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // client: SELECT WHERE tenant_id matches JWT claim
    pgPolicy('locations_client_read', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
  ]
)
