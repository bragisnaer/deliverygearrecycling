-- Create DB roles safely (idempotent — skips if already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'client_role')  THEN CREATE ROLE client_role;  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'prison_role')  THEN CREATE ROLE prison_role;  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reco_admin')   THEN CREATE ROLE reco_admin;   END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reco_role')    THEN CREATE ROLE reco_role;    END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'transport_role') THEN CREATE ROLE transport_role; END IF;
END $$;

-- Manual migration: RLS FORCE, audit trigger, seed system_settings
-- This migration augments the Drizzle-generated 0000 migration with:
-- 1. FORCE ROW LEVEL SECURITY (ensures table owner is also subject to RLS)
-- 2. Audit log trigger function and trigger bindings
-- 3. Seed INSERT for system_settings singleton row

-- ============================================================
-- 1. FORCE ROW LEVEL SECURITY on all tenant-scoped tables
--    ENABLE is done by Drizzle migration; FORCE ensures even
--    the table owner (superuser bypass) is denied by policies.
-- ============================================================
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
ALTER TABLE prison_facilities FORCE ROW LEVEL SECURITY;
ALTER TABLE system_settings FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Audit log trigger function (SECURITY DEFINER so it can
--    INSERT into audit_log regardless of calling role's RLS)
-- ============================================================
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, tenant_id, action, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE
      WHEN TG_TABLE_NAME = 'system_settings' THEN NULL
      WHEN TG_TABLE_NAME = 'tenants' THEN COALESCE(NEW.id::text, OLD.id::text)
      ELSE COALESCE(
        CASE WHEN NEW IS NOT NULL THEN (to_jsonb(NEW))->>'tenant_id' END,
        CASE WHEN OLD IS NOT NULL THEN (to_jsonb(OLD))->>'tenant_id' END
      )
    END,
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    current_setting('request.jwt.claim.sub', true)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to all editable tables
CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_tenants
  AFTER INSERT OR UPDATE OR DELETE ON tenants
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_prison_facilities
  AFTER INSERT OR UPDATE OR DELETE ON prison_facilities
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_system_settings
  AFTER INSERT OR UPDATE OR DELETE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================================
-- 3. Seed system_settings singleton row (default values)
-- ============================================================
INSERT INTO system_settings (id, exchange_rate_eur_dkk, warehouse_ageing_threshold_days, discrepancy_alert_threshold_pct)
VALUES (1, 7.4600, 14, 15)
ON CONFLICT (id) DO NOTHING;
