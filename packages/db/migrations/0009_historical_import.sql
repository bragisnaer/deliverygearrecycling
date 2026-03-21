-- Phase 10: Historical Data Import — is_imported flag + import_jobs table

-- Add is_imported boolean to all five importable tables
ALTER TABLE pickups ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE intake_records ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE processing_reports ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE financial_records ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE transport_bookings ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false;

-- Import jobs tracking table — stores parsed rows + validation errors for preview-then-commit
CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,  -- 'pickup_log' | 'intake_log' | 'greenloop' | 'invoice_binder' | 'transport_costs'
  target_tenant_id TEXT NOT NULL REFERENCES tenants(id),
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'ready' | 'has_errors' | 'committed'
  file_name TEXT NOT NULL DEFAULT '',
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  rows_json TEXT NOT NULL DEFAULT '[]',
  errors_json TEXT NOT NULL DEFAULT '[]',
  column_mapping_json TEXT,  -- nullable — stores user's column-to-field mapping
  created_by UUID REFERENCES users(id),
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_jobs FORCE ROW LEVEL SECURITY;

-- RLS: reco-admin only
CREATE POLICY import_jobs_reco_admin_all ON import_jobs
  AS PERMISSIVE FOR ALL TO reco_admin_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON import_jobs TO reco_admin_role;
