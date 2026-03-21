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
import { recoAdminRole, recoRole, transportRole } from './auth'
import { tenants } from './tenants'
import { prisonFacilities } from './tenants'
import { users } from './auth'
import { pickups } from './pickups'

// Transport type: direct delivery to prison vs. consolidation via warehouse (TRANS-01)
export const transportTypeEnum = pgEnum('transport_type', [
  'direct',
  'consolidation',
])

// Outbound shipment lifecycle status
export const outboundShipmentStatusEnum = pgEnum('outbound_shipment_status', [
  'created',
  'in_transit',
  'delivered',
])

// Transport provider registry (TRANS-01, TRANS-02)
export const transportProviders = pgTable(
  'transport_providers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    contact_email: text('contact_email'), // nullable
    contact_phone: text('contact_phone'), // nullable
    service_regions: text('service_regions'), // nullable — comma-separated ISO 3166-1 alpha-2 codes
    provider_type: transportTypeEnum('provider_type').notNull(),
    warehouse_address: text('warehouse_address'), // nullable — consolidation providers only
    has_platform_access: boolean('has_platform_access').notNull().default(false),
    user_id: uuid('user_id').references(() => users.id), // nullable — platform user for JWT-based RLS
    active: boolean('active').notNull().default(true),
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  () => [
    // Default deny: restrictive USING(false) — fail-closed base policy
    pgPolicy('transport_providers_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('transport_providers_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('transport_providers_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // transport_role: SELECT own provider record via user_id = JWT sub
    pgPolicy('transport_providers_transport_read', {
      as: 'permissive',
      to: transportRole,
      for: 'select',
      using: sql`user_id::text = current_setting('request.jwt.claim.sub', true)`,
    }),
  ]
)

// Join table: links transport providers to their client tenants (TRANS-02)
export const transportProviderClients = pgTable(
  'transport_provider_clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transport_provider_id: uuid('transport_provider_id')
      .notNull()
      .references(() => transportProviders.id, { onDelete: 'cascade' }),
    tenant_id: text('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
  },
  (t) => [
    index('transport_provider_clients_provider_id_idx').on(
      t.transport_provider_id
    ),
    index('transport_provider_clients_tenant_id_idx').on(t.tenant_id),
    // Default deny: restrictive USING(false)
    pgPolicy('transport_provider_clients_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('transport_provider_clients_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // transport_role: SELECT own rows via parent provider.user_id = JWT sub
    pgPolicy('transport_provider_clients_transport_read', {
      as: 'permissive',
      to: transportRole,
      for: 'select',
      using: sql`EXISTS (
        SELECT 1
        FROM transport_providers tp
        WHERE tp.id = transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )`,
    }),
  ]
)

// Transport booking — links a pickup to a provider for a specific route (TRANS-01, TRANS-07)
// Two-leg cost model: market→destination stored here; warehouse→prison on outbound_shipments
export const transportBookings = pgTable(
  'transport_bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pickup_id: uuid('pickup_id')
      .notNull()
      .references(() => pickups.id, { onDelete: 'cascade' }),
    transport_provider_id: uuid('transport_provider_id')
      .notNull()
      .references(() => transportProviders.id),
    transport_type: transportTypeEnum('transport_type').notNull(),
    prison_facility_id: uuid('prison_facility_id').references(
      () => prisonFacilities.id
    ), // nullable — set for direct, null for consolidation
    transport_cost_market_to_destination_eur: numeric(
      'transport_cost_market_to_destination_eur',
      { precision: 12, scale: 4 }
    ), // nullable — financial data, not visible to transport_role
    confirmed_pickup_date: timestamp('confirmed_pickup_date'), // nullable
    delivery_notes: text('delivery_notes'), // nullable
    proof_of_delivery_path: text('proof_of_delivery_path'), // nullable — storage path
    booked_by: uuid('booked_by').references(() => users.id), // nullable
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
    is_imported: boolean('is_imported').notNull().default(false),
  },
  (t) => [
    index('transport_bookings_pickup_id_idx').on(t.pickup_id),
    // Default deny: restrictive USING(false)
    pgPolicy('transport_bookings_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('transport_bookings_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('transport_bookings_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // transport_role: SELECT + UPDATE rows for their provider (no pricing columns — enforced at app layer)
    pgPolicy('transport_bookings_transport_read', {
      as: 'permissive',
      to: transportRole,
      for: 'select',
      using: sql`EXISTS (
        SELECT 1
        FROM transport_provider_clients tpc
        JOIN transport_providers tp ON tp.id = tpc.transport_provider_id
        WHERE tpc.transport_provider_id = transport_bookings.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )`,
    }),
    pgPolicy('transport_bookings_transport_update', {
      as: 'permissive',
      to: transportRole,
      for: 'update',
      using: sql`EXISTS (
        SELECT 1
        FROM transport_provider_clients tpc
        JOIN transport_providers tp ON tp.id = tpc.transport_provider_id
        WHERE tpc.transport_provider_id = transport_bookings.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1
        FROM transport_provider_clients tpc
        JOIN transport_providers tp ON tp.id = tpc.transport_provider_id
        WHERE tpc.transport_provider_id = transport_bookings.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )`,
    }),
  ]
)

// Outbound shipment — consolidation batch from warehouse to prison (TRANS-01, TRANS-07)
// transport_cost_warehouse_to_prison_eur: second leg of the two-leg cost model
export const outboundShipments = pgTable(
  'outbound_shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transport_provider_id: uuid('transport_provider_id')
      .notNull()
      .references(() => transportProviders.id),
    prison_facility_id: uuid('prison_facility_id')
      .notNull()
      .references(() => prisonFacilities.id),
    transport_cost_warehouse_to_prison_eur: numeric(
      'transport_cost_warehouse_to_prison_eur',
      { precision: 12, scale: 4 }
    ).notNull(),
    total_pallet_count: integer('total_pallet_count').notNull(),
    status: outboundShipmentStatusEnum('status').notNull().default('created'),
    dispatched_at: timestamp('dispatched_at'), // nullable
    delivered_at: timestamp('delivered_at'), // nullable
    created_by: uuid('created_by').references(() => users.id), // nullable
    created_at: timestamp('created_at').notNull().defaultNow(),
    updated_at: timestamp('updated_at').notNull().defaultNow(),
  },
  () => [
    // Default deny: restrictive USING(false)
    pgPolicy('outbound_shipments_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('outbound_shipments_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('outbound_shipments_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // transport_role: SELECT + UPDATE for their provider
    pgPolicy('outbound_shipments_transport_read', {
      as: 'permissive',
      to: transportRole,
      for: 'select',
      using: sql`EXISTS (
        SELECT 1
        FROM transport_providers tp
        WHERE tp.id = outbound_shipments.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )`,
    }),
    pgPolicy('outbound_shipments_transport_update', {
      as: 'permissive',
      to: transportRole,
      for: 'update',
      using: sql`EXISTS (
        SELECT 1
        FROM transport_providers tp
        WHERE tp.id = outbound_shipments.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1
        FROM transport_providers tp
        WHERE tp.id = outbound_shipments.transport_provider_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )`,
    }),
  ]
)

// Join table: pickups included in a consolidation outbound shipment
// Stores allocated pallet count and pre-computed pro-rata cost share
export const outboundShipmentPickups = pgTable(
  'outbound_shipment_pickups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    outbound_shipment_id: uuid('outbound_shipment_id')
      .notNull()
      .references(() => outboundShipments.id, { onDelete: 'cascade' }),
    pickup_id: uuid('pickup_id')
      .notNull()
      .references(() => pickups.id),
    pallet_count: integer('pallet_count').notNull(),
    allocated_cost_eur: numeric('allocated_cost_eur', {
      precision: 12,
      scale: 4,
    }), // nullable — pre-computed pro-rata cost share
  },
  (t) => [
    index('outbound_shipment_pickups_shipment_id_idx').on(
      t.outbound_shipment_id
    ),
    // Default deny: restrictive USING(false)
    pgPolicy('outbound_shipment_pickups_deny_all', {
      as: 'restrictive',
      for: 'all',
      using: sql`false`,
    }),
    // reco-admin: full CRUD
    pgPolicy('outbound_shipment_pickups_reco_admin_all', {
      as: 'permissive',
      to: recoAdminRole,
      for: 'all',
      using: sql`true`,
      withCheck: sql`true`,
    }),
    // reco: SELECT only
    pgPolicy('outbound_shipment_pickups_reco_read', {
      as: 'permissive',
      to: recoRole,
      for: 'select',
      using: sql`true`,
    }),
    // transport_role: SELECT via parent outbound_shipment
    pgPolicy('outbound_shipment_pickups_transport_read', {
      as: 'permissive',
      to: transportRole,
      for: 'select',
      using: sql`EXISTS (
        SELECT 1
        FROM outbound_shipments os
        JOIN transport_providers tp ON tp.id = os.transport_provider_id
        WHERE os.id = outbound_shipment_id
          AND tp.user_id::text = current_setting('request.jwt.claim.sub', true)
      )`,
    }),
  ]
)
