-- Manual migration: Phase 4 pickup booking and transport management schema
-- This migration covers all Phase 4 tables, enums, RLS, grants, triggers, and seed data.
-- Companion to any drizzle-kit generated migration for phase 4 schema changes.
--
-- 1. Add standard_pallet_weight_grams to system_settings
-- 2. Create enums: pickup_status, transport_type, outbound_shipment_status
-- 3. Create tables: locations, pickups, pickup_lines, transport_providers,
--    transport_provider_clients, transport_bookings, outbound_shipments,
--    outbound_shipment_pickups, notifications
-- 4. Add FK constraint: users.location_id → locations.id
-- 5. ENABLE and FORCE ROW LEVEL SECURITY on all new tables
-- 6. GRANT permissions to DB roles
-- 7. Create PU-YYYY-NNNN trigger
-- 8. Create indexes
-- 9. Seed Wolt Copenhagen HQ location

-- ============================================================
-- 1. ALTER system_settings — add standard pallet weight
-- ============================================================
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS standard_pallet_weight_grams integer NOT NULL DEFAULT 25000;

-- ============================================================
-- 2. CREATE ENUMS (idempotent via DO block)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE pickup_status AS ENUM (
    'submitted',
    'confirmed',
    'transport_booked',
    'picked_up',
    'at_warehouse',
    'in_outbound_shipment',
    'in_transit',
    'delivered',
    'intake_registered',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE transport_type AS ENUM ('direct', 'consolidation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE outbound_shipment_status AS ENUM ('created', 'in_transit', 'delivered');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. CREATE TABLES
-- ============================================================

-- locations: client physical collection sites (PICKUP-02)
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  country text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- pickups: one booking per collection event (PICKUP-02)
-- reference is set to PU-YYYY-NNNN by trigger below; default '' avoids NOT NULL violation
CREATE TABLE IF NOT EXISTS pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES locations(id),
  reference text NOT NULL DEFAULT '',
  status pickup_status NOT NULL DEFAULT 'submitted',
  pallet_count integer NOT NULL,
  pallet_dimensions text,
  estimated_weight_grams numeric(12, 2),
  preferred_date timestamp NOT NULL,
  confirmed_date timestamp,
  notes text,
  cancellation_reason text,
  cancelled_at timestamp,
  cancelled_by uuid REFERENCES users(id),
  submitted_by uuid NOT NULL REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- pickup_lines: per-product-type line items for a pickup (PICKUP-02)
CREATE TABLE IF NOT EXISTS pickup_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  pickup_id uuid NOT NULL REFERENCES pickups(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- transport_providers: carrier registry (TRANS-01, TRANS-02)
CREATE TABLE IF NOT EXISTS transport_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  contact_email text,
  contact_phone text,
  service_regions text,
  provider_type transport_type NOT NULL,
  warehouse_address text,
  has_platform_access boolean NOT NULL DEFAULT false,
  user_id uuid REFERENCES users(id),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- transport_provider_clients: join table — provider ↔ tenant (TRANS-02)
CREATE TABLE IF NOT EXISTS transport_provider_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  transport_provider_id uuid NOT NULL REFERENCES transport_providers(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE
);

-- transport_bookings: pickup → provider booking (TRANS-01, TRANS-07)
-- transport_cost_market_to_destination_eur: leg 1 of two-leg cost model
CREATE TABLE IF NOT EXISTS transport_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  pickup_id uuid NOT NULL REFERENCES pickups(id) ON DELETE CASCADE,
  transport_provider_id uuid NOT NULL REFERENCES transport_providers(id),
  transport_type transport_type NOT NULL,
  prison_facility_id uuid REFERENCES prison_facilities(id),
  transport_cost_market_to_destination_eur numeric(12, 4),
  confirmed_pickup_date timestamp,
  delivery_notes text,
  proof_of_delivery_path text,
  booked_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- outbound_shipments: consolidation batch from warehouse to prison (TRANS-01)
-- transport_cost_warehouse_to_prison_eur: leg 2 of two-leg cost model
CREATE TABLE IF NOT EXISTS outbound_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  transport_provider_id uuid NOT NULL REFERENCES transport_providers(id),
  prison_facility_id uuid NOT NULL REFERENCES prison_facilities(id),
  transport_cost_warehouse_to_prison_eur numeric(12, 4) NOT NULL,
  total_pallet_count integer NOT NULL,
  status outbound_shipment_status NOT NULL DEFAULT 'created',
  dispatched_at timestamp,
  delivered_at timestamp,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- outbound_shipment_pickups: join table — outbound shipment ↔ pickup
CREATE TABLE IF NOT EXISTS outbound_shipment_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  outbound_shipment_id uuid NOT NULL REFERENCES outbound_shipments(id) ON DELETE CASCADE,
  pickup_id uuid NOT NULL REFERENCES pickups(id),
  pallet_count integer NOT NULL,
  allocated_cost_eur numeric(12, 4)
);

-- notifications: in-app alert system
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid REFERENCES users(id),
  tenant_id text,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  entity_type text,
  entity_id text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. ALTER TABLE users — add FK constraint for location_id
--    (Do NOT modify Drizzle schema file — raw SQL per research guidance)
-- ============================================================
ALTER TABLE users
  ADD CONSTRAINT users_location_id_fk
  FOREIGN KEY (location_id) REFERENCES locations(id);

-- ============================================================
-- 5. ENABLE and FORCE ROW LEVEL SECURITY on all new tables
-- ============================================================
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_provider_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_shipment_pickups ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE locations FORCE ROW LEVEL SECURITY;
ALTER TABLE pickups FORCE ROW LEVEL SECURITY;
ALTER TABLE pickup_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE transport_providers FORCE ROW LEVEL SECURITY;
ALTER TABLE transport_provider_clients FORCE ROW LEVEL SECURITY;
ALTER TABLE transport_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE outbound_shipments FORCE ROW LEVEL SECURITY;
ALTER TABLE outbound_shipment_pickups FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 6. GRANT permissions to DB roles
--    Each role that has a permissive RLS policy needs matching GRANT.
-- ============================================================

-- locations
GRANT SELECT, INSERT, UPDATE, DELETE ON locations TO reco_admin;
GRANT SELECT ON locations TO reco_role;
GRANT SELECT ON locations TO client_role;

-- pickups
GRANT SELECT, INSERT, UPDATE, DELETE ON pickups TO reco_admin;
GRANT SELECT ON pickups TO reco_role;
GRANT SELECT, INSERT ON pickups TO client_role;
GRANT SELECT ON pickups TO transport_role;

-- pickup_lines
GRANT SELECT, INSERT, UPDATE, DELETE ON pickup_lines TO reco_admin;
GRANT SELECT ON pickup_lines TO reco_role;
GRANT SELECT, INSERT ON pickup_lines TO client_role;

-- transport_providers
GRANT SELECT, INSERT, UPDATE, DELETE ON transport_providers TO reco_admin;
GRANT SELECT ON transport_providers TO reco_role;
GRANT SELECT ON transport_providers TO transport_role;

-- transport_provider_clients
GRANT SELECT, INSERT, UPDATE, DELETE ON transport_provider_clients TO reco_admin;
GRANT SELECT ON transport_provider_clients TO transport_role;

-- transport_bookings
GRANT SELECT, INSERT, UPDATE, DELETE ON transport_bookings TO reco_admin;
GRANT SELECT ON transport_bookings TO reco_role;
GRANT SELECT, UPDATE ON transport_bookings TO transport_role;

-- outbound_shipments
GRANT SELECT, INSERT, UPDATE, DELETE ON outbound_shipments TO reco_admin;
GRANT SELECT ON outbound_shipments TO reco_role;
GRANT SELECT, UPDATE ON outbound_shipments TO transport_role;

-- outbound_shipment_pickups
GRANT SELECT, INSERT, UPDATE, DELETE ON outbound_shipment_pickups TO reco_admin;
GRANT SELECT ON outbound_shipment_pickups TO reco_role;
GRANT SELECT ON outbound_shipment_pickups TO transport_role;

-- notifications
GRANT SELECT, INSERT, UPDATE ON notifications TO reco_admin;
GRANT SELECT ON notifications TO transport_role;

-- ============================================================
-- 7. PU-YYYY-NNNN trigger — auto-generate pickup reference
--    Uses per-year sequence to reset numbering each year (PICKUP-07)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_pickup_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT := to_char(NOW(), 'YYYY');
  seq_name TEXT := 'pickup_ref_seq_' || year_str;
  next_val BIGINT;
BEGIN
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', seq_name);
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  NEW.reference := 'PU-' || year_str || '-' || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_pickup_reference
  BEFORE INSERT ON pickups
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION generate_pickup_reference();

-- ============================================================
-- 8. CREATE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS locations_tenant_id_idx ON locations USING btree (tenant_id);

CREATE INDEX IF NOT EXISTS pickups_tenant_id_idx ON pickups USING btree (tenant_id);
CREATE INDEX IF NOT EXISTS pickups_status_idx ON pickups USING btree (status);
CREATE INDEX IF NOT EXISTS pickups_location_id_idx ON pickups USING btree (location_id);

CREATE INDEX IF NOT EXISTS pickup_lines_pickup_id_idx ON pickup_lines USING btree (pickup_id);

CREATE INDEX IF NOT EXISTS transport_provider_clients_provider_id_idx ON transport_provider_clients USING btree (transport_provider_id);
CREATE INDEX IF NOT EXISTS transport_provider_clients_tenant_id_idx ON transport_provider_clients USING btree (tenant_id);

CREATE INDEX IF NOT EXISTS transport_bookings_pickup_id_idx ON transport_bookings USING btree (pickup_id);

CREATE INDEX IF NOT EXISTS outbound_shipment_pickups_shipment_id_idx ON outbound_shipment_pickups USING btree (outbound_shipment_id);

-- ============================================================
-- 9. Seed Wolt Copenhagen HQ location for development
-- ============================================================
INSERT INTO locations (id, tenant_id, name, address, country, active)
VALUES (gen_random_uuid(), 'wolt', 'Wolt Copenhagen HQ', 'Copenhagen, Denmark', 'DK', true)
ON CONFLICT DO NOTHING;
