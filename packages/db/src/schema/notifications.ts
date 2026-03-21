import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, transportRole, clientRole, prisonRole } from './auth'
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
    // client_role: SELECT own notifications via user_id = JWT sub
    pgPolicy('notifications_client_read', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // client_role: UPDATE own notifications (mark as read)
    pgPolicy('notifications_client_update_read', {
      as: 'permissive',
      to: clientRole,
      for: 'update',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
      withCheck: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // prison_role: SELECT own notifications via user_id = JWT sub
    pgPolicy('notifications_prison_read', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // prison_role: UPDATE own notifications (mark as read)
    pgPolicy('notifications_prison_update_read', {
      as: 'permissive',
      to: prisonRole,
      for: 'update',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
      withCheck: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
  ]
)

// Notification mute preferences (NOTIF-02)
// CHECK constraint enforced at DB layer: critical types cannot be muted
export const notificationMutePreferences = pgTable(
  'notification_mute_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id')
      .notNull()
      .references(() => users.id),
    notification_type: text('notification_type').notNull(),
    muted: boolean('muted').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    unique('nmp_user_type_unique').on(t.user_id, t.notification_type),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('nmp_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('nmp_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // client_role: SELECT own
    pgPolicy('nmp_client_select', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // client_role: INSERT own
    pgPolicy('nmp_client_insert', {
      as: 'permissive',
      to: clientRole,
      for: 'insert',
      withCheck: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // client_role: UPDATE own
    pgPolicy('nmp_client_update', {
      as: 'permissive',
      to: clientRole,
      for: 'update',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
      withCheck: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // client_role: DELETE own
    pgPolicy('nmp_client_delete', {
      as: 'permissive',
      to: clientRole,
      for: 'delete',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // transport_role: SELECT own
    pgPolicy('nmp_transport_select', {
      as: 'permissive',
      to: transportRole,
      for: 'select',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // transport_role: INSERT own
    pgPolicy('nmp_transport_insert', {
      as: 'permissive',
      to: transportRole,
      for: 'insert',
      withCheck: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // transport_role: UPDATE own
    pgPolicy('nmp_transport_update', {
      as: 'permissive',
      to: transportRole,
      for: 'update',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
      withCheck: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // transport_role: DELETE own
    pgPolicy('nmp_transport_delete', {
      as: 'permissive',
      to: transportRole,
      for: 'delete',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // prison_role: SELECT own
    pgPolicy('nmp_prison_select', {
      as: 'permissive',
      to: prisonRole,
      for: 'select',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // prison_role: INSERT own
    pgPolicy('nmp_prison_insert', {
      as: 'permissive',
      to: prisonRole,
      for: 'insert',
      withCheck: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // prison_role: UPDATE own
    pgPolicy('nmp_prison_update', {
      as: 'permissive',
      to: prisonRole,
      for: 'update',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
      withCheck: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
    // prison_role: DELETE own
    pgPolicy('nmp_prison_delete', {
      as: 'permissive',
      to: prisonRole,
      for: 'delete',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
  ]
)
