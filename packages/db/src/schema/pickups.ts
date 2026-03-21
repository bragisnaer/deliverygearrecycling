import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { recoAdminRole, recoRole, clientRole, transportRole } from './auth'
import { tenants } from './tenants'
import { locations } from './locations'
import { users } from './auth'
import { products } from './products'

// Pickup lifecycle status enum (PICKUP-02, PICKUP-05)
export const pickupStatusEnum = pgEnum('pickup_status', [
  'submitted',
  'confirmed',
  'transport_booked',
  'picked_up',
  'at_warehouse',
  'in_outbound_shipment',
  'in_transit',
  'delivered',
  'intake_registered',
  'cancelled',
])

// Pickup bookings — one per collection event at a client location (PICKUP-02)
// reference is auto-set to PU-YYYY-NNNN by DB trigger (set in migration)
export const pickups = pgTable(
  'pickups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    location_id: uuid('location_id')
      .notNull()
      .references(() => locations.id),
    reference: text('reference').notNull().default(''), // overwritten by trigger
    status: pickupStatusEnum('status').notNull().default('submitted'),
    pallet_count: integer('pallet_count').notNull(),
    pallet_dimensions: text('pallet_dimensions'), // nullable — e.g. "120x80"
    estimated_weight_grams: numeric('estimated_weight_grams', {
      precision: 12,
      scale: 2,
    }), // nullable
    preferred_date: timestamp('preferred_date').notNull(),
    confirmed_date: timestamp('confirmed_date'), // nullable — set by reco/transport
    notes: text('notes'), // nullable
    cancellation_reason: text('cancellation_reason'), // nullable
    cancelled_at: timestamp('cancelled_at'), // nullable
    cancelled_by: uuid('cancelled_by').references(() => users.id), // nullable
    submitted_by: uuid('submitted_by')
      .notNull()
      .references(() => users.id),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
    is_imported: boolean('is_imported').notNull().default(false),
  },
  (t) => [
    index('pickups_tenant_id_idx').on(t.tenant_id),
    index('pickups_status_idx').on(t.status),
    index('pickups_location_id_idx').on(t.location_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('pickups_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('pickups_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('pickups_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // client: SELECT + INSERT WHERE tenant_id matches JWT claim
    pgPolicy('pickups_client_read_insert', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
    pgPolicy('pickups_client_insert', {
      as: 'permissive',
      to: clientRole,
      for: 'insert',
      withCheck: sql`tenant_id = current_setting('request.jwt.claim.tenant_id', true)`,
    }),
    // transport_role: SELECT via EXISTS on transport_provider_clients → transport_providers.user_id = JWT sub
    pgPolicy('pickups_transport_read', {
      as: 'permissive',
      to: transportRole,
      for: 'select',
      using: sql`EXISTS (
        SELECT 1
        FROM transport_provider_clients tpc
        JOIN transport_providers tp ON tp.id = tpc.transport_provider_id
        WHERE tpc.tenant_id = pickups.tenant_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )`,
    }),
  ]
)

// Pickup line items — one row per product type per pickup (PICKUP-02)
// Tenant-scoped via parent pickup (no direct tenant_id column)
export const pickupLines = pgTable(
  'pickup_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pickup_id: uuid('pickup_id')
      .notNull()
      .references(() => pickups.id, { onDelete: 'cascade' }),
    product_id: uuid('product_id')
      .notNull()
      .references(() => products.id),
    quantity: integer('quantity').notNull(),
    created_at: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('pickup_lines_pickup_id_idx').on(t.pickup_id),
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('pickup_lines_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('pickup_lines_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('pickup_lines_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // client: SELECT WHERE parent pickup belongs to their tenant (via EXISTS subquery)
    pgPolicy('pickup_lines_client_read', {
      as: 'permissive',
      to: clientRole,
      for: 'select',
      using: sql`EXISTS (SELECT 1 FROM pickups p WHERE p.id = pickup_id AND p.tenant_id = current_setting('request.jwt.claim.tenant_id', true))`,
    }),
    // client: INSERT WHERE parent pickup belongs to their tenant
    pgPolicy('pickup_lines_client_insert', {
      as: 'permissive',
      to: clientRole,
      for: 'insert',
      withCheck: sql`EXISTS (SELECT 1 FROM pickups p WHERE p.id = pickup_id AND p.tenant_id = current_setting('request.jwt.claim.tenant_id', true))`,
    }),
  ]
)
