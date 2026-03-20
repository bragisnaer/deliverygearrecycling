import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import {
  recoAdminRole,
  recoRole,
  clientRole,
  transportRole,
  prisonRole,
} from './auth'

// Global material library — cross-tenant shared reference data (PROD-06)
// No tenant_id: materials are managed by reco-admin and readable by all authenticated roles
export const materialLibrary = pgTable(
  'material_library',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  () => [
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('material_library_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD on material library
    pgPolicy('material_library_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // All authenticated roles: SELECT only
    pgPolicy('material_library_authenticated_read', {
      as: 'permissive',
      to: [recoRole, clientRole, transportRole, prisonRole],
      for: 'select',
      using: sql`true`,
    }),
  ]
)
