import {
  boolean,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, clientRole, prisonRole } from './auth'
import { users } from './auth'

// Manual context enum: determines which user group the page is for
export const manualContextEnum = pgEnum('manual_context', ['client', 'prison'])

// manual_pages: FAQ/help content managed by reco-admin
export const manualPages = pgTable(
  'manual_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    context: manualContextEnum('context').notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    content_md: text('content_md').notNull().default(''),
    published: boolean('published').notNull().default(false),
    display_order: integer('display_order').notNull().default(0),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
    updated_by: uuid('updated_by').references(() => users.id),
  },
  (t) => [
    unique('manual_pages_context_slug_unique').on(t.context, t.slug),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('mp_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('mp_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // client_role: SELECT published client pages only
    pgPolicy('mp_client_read', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`context = 'client' AND published = true`,
    }),
    // prison_role: SELECT published prison pages only
    pgPolicy('mp_prison_read', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`context = 'prison' AND published = true`,
    }),
  ]
)

// manual_page_versions: version history snapshots for manual_pages
export const manualPageVersions = pgTable(
  'manual_page_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    manual_page_id: uuid('manual_page_id')
      .notNull()
      .references(() => manualPages.id),
    content_md: text('content_md').notNull(),
    saved_by: uuid('saved_by').references(() => users.id),
    saved_at: timestamp('saved_at').notNull().defaultNow(),
  },
  () => [
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('mpv_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: SELECT (read history)
    pgPolicy('mpv_reco_admin_select', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'select',
      using: sql`true`,
    }),
    // reco-admin: INSERT (create snapshots)
    pgPolicy('mpv_reco_admin_insert', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'insert',
      withCheck: sql`true`,
    }),
  ]
)
