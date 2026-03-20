import {
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

export const tenantBranding = pgTable(
  'tenant_branding',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id')
      .notNull()
      .unique()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    logo_url: text('logo_url'),
    favicon_url: text('favicon_url'),
    primary_color: text('primary_color'),
    secondary_color: text('secondary_color'),
    background_color: text('background_color'),
    foreground_color: text('foreground_color'),
    accent_color: text('accent_color'),
    heading_font: text('heading_font'),
    body_font: text('body_font'),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('tenant_branding_tenant_id_idx').on(t.tenant_id),
    // Default deny
    pgPolicy('tenant_branding_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('tenant_branding_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('tenant_branding_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // client: SELECT own tenant only
    pgPolicy('tenant_branding_client_read', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
  ]
)
