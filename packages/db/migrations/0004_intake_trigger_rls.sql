-- Manual migration: Phase 5 prison intake and counting schema
-- This migration covers intake_records, intake_lines, batch_flags tables,
-- RLS force, grants, and the IN-YYYY-NNNN reference trigger.
--
-- 1. ENABLE and FORCE ROW LEVEL SECURITY on all new tables
-- 2. GRANT permissions to DB roles
-- 3. Create IN-YYYY-NNNN trigger for intake_records

-- ============================================================
-- 1. ENABLE and FORCE ROW LEVEL SECURITY
--    ENABLE is done by Drizzle migration; FORCE ensures even
--    the table owner (superuser bypass) is denied by policies.
-- ============================================================
ALTER TABLE intake_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_records FORCE ROW LEVEL SECURITY;

ALTER TABLE intake_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE batch_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_flags FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 2. GRANT permissions to DB roles
--    Each role that has a permissive RLS policy needs a matching GRANT.
--    RLS further restricts what each grant allows.
-- ============================================================

-- intake_records
GRANT SELECT, INSERT, UPDATE, DELETE ON intake_records TO reco_admin;
GRANT SELECT ON intake_records TO reco_role;
GRANT SELECT ON intake_records TO client_role;
GRANT SELECT, INSERT ON intake_records TO prison_role;

-- intake_lines
GRANT SELECT, INSERT, UPDATE, DELETE ON intake_lines TO reco_admin;
GRANT SELECT ON intake_lines TO reco_role;
GRANT SELECT, INSERT ON intake_lines TO prison_role;

-- batch_flags
GRANT SELECT, INSERT, UPDATE, DELETE ON batch_flags TO reco_admin;
GRANT SELECT ON batch_flags TO reco_role;
GRANT SELECT ON batch_flags TO prison_role;

-- ============================================================
-- 3. IN-YYYY-NNNN trigger — auto-generate intake reference
--    Uses per-year sequence to reset numbering each year (INTAKE-01)
-- ============================================================
CREATE OR REPLACE FUNCTION generate_intake_reference()
RETURNS TRIGGER AS $$
DECLARE
  year_str TEXT := to_char(NOW(), 'YYYY');
  seq_name TEXT := 'intake_ref_seq_' || year_str;
  next_val BIGINT;
BEGIN
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I START 1', seq_name);
  EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
  NEW.reference := 'IN-' || year_str || '-' || lpad(next_val::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_intake_reference
  BEFORE INSERT ON intake_records
  FOR EACH ROW
  WHEN (NEW.reference IS NULL OR NEW.reference = '')
  EXECUTE FUNCTION generate_intake_reference();
