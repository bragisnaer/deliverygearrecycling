import {
  boolean,
  index,
  pgEnum,
  pgPolicy,
  pgRole,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// PostgreSQL roles — createRole: false means Drizzle references existing DB roles
// These must be created via the initial migration SQL
export const recoAdminRole = pgRole('reco_admin', { createRole: false })
export const recoRole = pgRole('reco_role', { createRole: false })
export const clientRole = pgRole('client_role', { createRole: false })
export const transportRole = pgRole('transport_role', { createRole: false })
export const prisonRole = pgRole('prison_role', { createRole: false })

// Six-value user role enum (AUTH-01)
export const userRoleEnum = pgEnum('user_role', [
  'reco-admin',
  'reco',
  'client',
  'client-global',
  'transport',
  'prison',
])

// Auth.js adapter: users table with custom columns
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name'),
    email: text('email').notNull().unique(),
    emailVerified: timestamp('emailVerified'), // Auth.js adapter requires camelCase
    image: text('image'),
    password_hash: text('password_hash'), // nullable — magic-link-only users have null
    // Custom columns
    role: userRoleEnum('role').notNull().default('client'),
    tenant_id: text('tenant_id'), // null for reco-admin, reco (ROUTE-04, ROUTE-05)
    location_id: uuid('location_id'), // AUTH-07: client role locked to location
    facility_id: uuid('facility_id'), // prison role locked to facility
    can_view_financials: boolean('can_view_financials').notNull().default(false), // AUTH-08
    active: boolean('active').notNull().default(true), // AUTH-09: deactivation
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // ROUTE-05: tenant_id index on every tenant-scoped table
    index('users_tenant_id_idx').on(t.tenant_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('users_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD on all users
    pgPolicy('users_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('users_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // client / client-global: SELECT WHERE tenant_id matches JWT claim
    pgPolicy('users_client_read', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
    // prison: SELECT WHERE facility_id matches JWT claim
    pgPolicy('users_prison_read', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`facility_id::text = current_setting('request.jwt.claim.facility_id', true)`,
    }),
  ]
)

// Auth.js adapter: accounts table (required for OAuth providers)
export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: timestamp('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]
)

// Auth.js adapter: verification_tokens table (required for magic link / Resend provider)
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull().unique(),
    expires: timestamp('expires').notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })]
)
