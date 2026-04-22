-- Manual migration: Phase 7 financial records schema
-- This migration covers all DDL for Plan 07-01:
-- 1. New enum: invoice_status
-- 2. CREATE TABLE financial_records with indexes, RLS, GRANTs
-- 3. Auto-create trigger: financial_record_on_intake_insert
-- 4. Audit trigger on financial_records

-- ============================================================
-- 1. New enum: invoice_status (idempotent via DO block)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM ('not_invoiced', 'invoiced', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. CREATE financial_records table
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_record_id uuid NOT NULL UNIQUE REFERENCES intake_records(id),
  tenant_id text NOT NULL REFERENCES tenants(id),
  transport_cost_eur numeric(12, 4),
  estimated_invoice_amount_eur numeric(12, 4),
  invoice_status invoice_status NOT NULL DEFAULT 'not_invoiced',
  invoice_number text,
  invoice_date timestamp,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financial_records_intake_record_id_idx ON financial_records(intake_record_id);
CREATE INDEX IF NOT EXISTS financial_records_tenant_id_idx ON financial_records(tenant_id);
CREATE INDEX IF NOT EXISTS financial_records_invoice_status_idx ON financial_records(invoice_status);

-- ============================================================
-- 3. ENABLE + FORCE RLS
--    FORCE ensures even the table owner (superuser bypass) is denied.
-- ============================================================
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS policies (FIN-06)
--    fail-closed: no policies for client_role, transport_role, prison_role
-- ============================================================

-- Default deny: restrictive USING(false) — fail-closed base policy
DO $$ BEGIN
  CREATE POLICY financial_records_deny_all ON financial_records
    AS RESTRICTIVE FOR ALL
    USING (false);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- reco-admin: full CRUD (role is "reco_admin", not "reco_admin_role")
DO $$ BEGIN
  CREATE POLICY financial_records_reco_admin_all ON financial_records
    AS PERMISSIVE FOR ALL TO reco_admin
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- reco: SELECT only when can_view_financials is true (FIN-06, AUTH-08)
DO $$ BEGIN
  CREATE POLICY financial_records_reco_read ON financial_records
    AS PERMISSIVE FOR SELECT TO reco_role
    USING (
      EXISTS (
        SELECT 1 FROM users u
        WHERE u.id::text = current_setting('request.jwt.claim.sub', true)
          AND u.can_view_financials = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. GRANT permissions to DB roles
--    Role is "reco_admin" (not "reco_admin_role")
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON financial_records TO reco_admin;
GRANT SELECT ON financial_records TO reco_role;
-- No GRANTs for client_role, transport_role, prison_role (fail-closed, FIN-06)

-- ============================================================
-- 6. Auto-create trigger: insert a financial_records row on every intake_records INSERT
--    SECURITY DEFINER: runs as table owner, bypasses RLS for the trigger action
-- ============================================================
CREATE OR REPLACE FUNCTION create_financial_record()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO financial_records (
    intake_record_id, tenant_id, invoice_status, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.tenant_id, 'not_invoiced', NOW(), NOW()
  )
  ON CONFLICT (intake_record_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER financial_record_on_intake_insert
  AFTER INSERT ON intake_records
  FOR EACH ROW EXECUTE FUNCTION create_financial_record();

-- ============================================================
-- 7. Audit trigger on financial_records (AUDIT-01)
--    References existing audit_log_trigger() from 0001_rls_and_triggers.sql
-- ============================================================
CREATE OR REPLACE TRIGGER financial_records_audit
  AFTER INSERT OR UPDATE OR DELETE ON financial_records
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
