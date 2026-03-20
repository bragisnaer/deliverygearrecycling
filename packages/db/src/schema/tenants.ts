import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, recoRole, clientRole, prisonRole } from './auth'

// Root tenant table — no tenant_id (this IS the tenant)
export const tenants = pgTable(
  'tenants',
  {
    id: text('id').primaryKey(), // slug, e.g. "wolt"
    name: text('name').notNull(),
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  () => [
    // Default deny: restrictive USING(false)
    pgPolicy('tenants_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('tenants_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('tenants_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // client / client-global: SELECT WHERE id matches JWT tenant_id claim
    pgPolicy('tenants_client_read', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
  ]
)

// Prison facility registry (SETTINGS-02)
// No tenant_id — facilities are global, managed by reco-admin
export const prisonFacilities = pgTable(
  'prison_facilities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(), // URL-safe identifier, e.g. "vejle-fengsel"
    name: text('name').notNull(), // used as login identifier
    address: text('address').notNull(), // delivery address for transport
    contact_email: text('contact_email').notNull(),
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  () => [
    // Default deny: restrictive USING(false)
    pgPolicy('prison_facilities_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('prison_facilities_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('prison_facilities_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // prison: SELECT WHERE id matches JWT facility_id claim
    pgPolicy('prison_facilities_prison_read', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`id::text = current_setting('request.jwt.claim.facility_id', true)`,
    }),
  ]
)
