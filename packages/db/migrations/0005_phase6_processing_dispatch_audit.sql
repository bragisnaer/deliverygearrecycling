-- Manual migration: Phase 6 prison processing, dispatch, and audit trail
-- This migration covers all DDL for Phase 6:
-- 1. New enums: activity_type, size_bucket, dispatch_status, product_category
-- 2. ALTER existing tables: intake_records (voided columns), products (product_category)
-- 3. New tables: processing_reports, processing_report_lines, outbound_dispatches, outbound_dispatch_lines
-- 4. ENABLE + FORCE RLS on all new tables
-- 5. GRANT permissions to DB roles
-- 6. Audit triggers on intake_records, processing_reports, outbound_dispatches
-- 7. Prison role UPDATE RLS policy on intake_records

-- ============================================================
-- 1. New enums (idempotent via DO blocks)
-- ============================================================
DO $$ BEGIN CREATE TYPE activity_type AS ENUM ('wash', 'pack'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE size_bucket AS ENUM ('XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE dispatch_status AS ENUM ('created', 'picked_up', 'delivered'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE product_category AS ENUM ('clothing', 'bag', 'equipment', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. ALTER existing tables
-- ============================================================

-- Voided columns on intake_records (AUDIT-04)
ALTER TABLE intake_records ADD COLUMN IF NOT EXISTS voided boolean NOT NULL DEFAULT false;
ALTER TABLE intake_records ADD COLUMN IF NOT EXISTS void_reason text;

-- Product category on products (for processing form clothing detection)
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_category product_category NOT NULL DEFAULT 'other';

-- Seed product_category for known Wolt products
UPDATE products SET product_category = 'clothing' WHERE name ILIKE '%Clothing%';
UPDATE products SET product_category = 'bag' WHERE name ILIKE '%Bag%';
UPDATE products SET product_category = 'equipment' WHERE name ILIKE '%Heating Plate%';

-- ============================================================
-- 3. CREATE processing_reports table
-- ============================================================
CREATE TABLE IF NOT EXISTS processing_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prison_facility_id uuid NOT NULL REFERENCES prison_facilities(id),
  intake_record_id uuid REFERENCES intake_records(id),
  tenant_id text NOT NULL REFERENCES tenants(id),
  staff_name text NOT NULL,
  activity_type activity_type NOT NULL,
  product_id uuid NOT NULL REFERENCES products(id),
  report_date timestamp NOT NULL,
  notes text,
  voided boolean NOT NULL DEFAULT false,
  void_reason text,
  submitted_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS processing_reports_tenant_id_idx ON processing_reports(tenant_id);
CREATE INDEX IF NOT EXISTS processing_reports_prison_facility_id_idx ON processing_reports(prison_facility_id);
CREATE INDEX IF NOT EXISTS processing_reports_intake_record_id_idx ON processing_reports(intake_record_id);

-- ============================================================
-- 4. CREATE processing_report_lines table
-- ============================================================
CREATE TABLE IF NOT EXISTS processing_report_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processing_report_id uuid NOT NULL REFERENCES processing_reports(id) ON DELETE CASCADE,
  size_bucket size_bucket,
  quantity integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS processing_report_lines_report_id_idx ON processing_report_lines(processing_report_id);

-- ============================================================
-- 5. CREATE outbound_dispatches table
-- ============================================================
CREATE TABLE IF NOT EXISTS outbound_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prison_facility_id uuid NOT NULL REFERENCES prison_facilities(id),
  tenant_id text NOT NULL REFERENCES tenants(id),
  dispatch_date timestamp NOT NULL,
  destination text NOT NULL,
  carrier text,
  notes text,
  status dispatch_status NOT NULL DEFAULT 'created',
  voided boolean NOT NULL DEFAULT false,
  void_reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbound_dispatches_tenant_id_idx ON outbound_dispatches(tenant_id);
CREATE INDEX IF NOT EXISTS outbound_dispatches_prison_facility_id_idx ON outbound_dispatches(prison_facility_id);

-- ============================================================
-- 6. CREATE outbound_dispatch_lines table
-- ============================================================
CREATE TABLE IF NOT EXISTS outbound_dispatch_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_dispatch_id uuid NOT NULL REFERENCES outbound_dispatches(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  size_bucket size_bucket,
  sku_code text,
  quantity integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbound_dispatch_lines_dispatch_id_idx ON outbound_dispatch_lines(outbound_dispatch_id);

-- Add intake_record_id FK to outbound_dispatches (schema-migration alignment fix)
ALTER TABLE outbound_dispatches ADD COLUMN IF NOT EXISTS intake_record_id uuid REFERENCES intake_records(id);
CREATE INDEX IF NOT EXISTS outbound_dispatches_intake_record_id_idx ON outbound_dispatches(intake_record_id);

-- ============================================================
-- 7. ENABLE + FORCE RLS on all new tables
--    ENABLE is done here (not by Drizzle — these are raw SQL tables).
--    FORCE ensures even the table owner (superuser bypass) is denied.
-- ============================================================
ALTER TABLE processing_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE processing_report_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_report_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE outbound_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_dispatches FORCE ROW LEVEL SECURITY;
ALTER TABLE outbound_dispatch_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_dispatch_lines FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 8. GRANT permissions to DB roles
--    Role is "reco_admin" (not "reco_admin_role")
-- ============================================================

-- processing_reports
GRANT SELECT, INSERT, UPDATE ON processing_reports TO prison_role;
GRANT SELECT, INSERT ON processing_report_lines TO prison_role;

-- Prison role UPDATE on intake_records (Phase 5 only granted SELECT, INSERT)
GRANT UPDATE ON intake_records TO prison_role;

-- Prison role on outbound_dispatches (SELECT only — DISPATCH-04)
GRANT SELECT ON outbound_dispatches TO prison_role;
GRANT SELECT ON outbound_dispatch_lines TO prison_role;

-- reco roles on all new tables
GRANT SELECT ON processing_reports TO reco_role;
GRANT SELECT ON processing_report_lines TO reco_role;
GRANT SELECT ON outbound_dispatches TO reco_role;
GRANT SELECT ON outbound_dispatch_lines TO reco_role;

GRANT ALL ON processing_reports TO reco_admin;
GRANT ALL ON processing_report_lines TO reco_admin;
GRANT ALL ON outbound_dispatches TO reco_admin;
GRANT ALL ON outbound_dispatch_lines TO reco_admin;

-- ============================================================
-- 9. Audit triggers (AUDIT-01, AUDIT-06)
--    References existing audit_log_trigger() from 0001_rls_and_triggers.sql
--    CREATE OR REPLACE TRIGGER for idempotency (PG14+)
-- ============================================================
CREATE OR REPLACE TRIGGER audit_intake_records
  AFTER INSERT OR UPDATE OR DELETE ON intake_records
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_processing_reports
  AFTER INSERT OR UPDATE OR DELETE ON processing_reports
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE OR REPLACE TRIGGER audit_outbound_dispatches
  AFTER INSERT OR UPDATE OR DELETE ON outbound_dispatches
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================================
-- 10. Prison role UPDATE RLS policy on intake_records (AUDIT-04)
--     Enables prison staff to void (update voided/void_reason) their own facility's records
-- ============================================================
DO $$ BEGIN
  CREATE POLICY intake_records_prison_update ON intake_records
    AS PERMISSIVE FOR UPDATE TO prison_role
    USING (prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true))
    WITH CHECK (prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
