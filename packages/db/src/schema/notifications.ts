import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, transportRole } from './auth'
import { users } from './auth'

// In-app notification alerts (NOTIFY-01)
// user_id: null means broadcast to all users in a tenant
// tenant_id: null means platform-wide reco-admin notification
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').references(() => users.id), // nullable
    tenant_id: text('tenant_id'), // nullable — no FK, allows reco-admin level notifications
    type: text('type').notNull(), // e.g. "pickup_confirmed", "transport_booked"
    title: text('title').notNull(),
    body: text('body'), // nullable
    entity_type: text('entity_type'), // nullable — e.g. "pickup", "transport_booking"
    entity_id: text('entity_id'), // nullable — UUID of the related entity
    read: boolean('read').notNull().default(false),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  () => [
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('notifications_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: SELECT + INSERT + UPDATE (create and manage all notifications)
    pgPolicy('notifications_reco_admin_read_write', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'select',
      using: sql`true`,
    }),
    pgPolicy('notifications_reco_admin_insert', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'insert',
      withCheck: sql`true`,
    }),
    pgPolicy('notifications_reco_admin_update', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'update',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // transport_role: SELECT own notifications via user_id = JWT sub
    pgPolicy('notifications_transport_read', {
      as: 'permissive',
      to: transportRole,
      for: 'select',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
  ]
)
