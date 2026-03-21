-- Phase 9: Notifications and Manuals
-- This migration covers:
-- 1. notification_mute_preferences table with CHECK constraint for critical types
-- 2. manual_context enum
-- 3. manual_pages table
-- 4. manual_page_versions table
-- 5. ENABLE + FORCE RLS on all new tables
-- 6. RLS policies on notification_mute_preferences
-- 7. RLS policies extending notifications for client + prison roles
-- 8. RLS policies on manual_pages
-- 9. RLS policies on manual_page_versions
-- 10. Audit trigger on manual_pages
-- 11. GRANTs
-- 12. Supabase Realtime publication for notifications
-- 13. Indexes

-- ============================================================
-- 1. notification_mute_preferences table
--    CHECK constraint enforces that critical notification types cannot be muted
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_mute_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  muted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type),
  CHECK (notification_type NOT IN (
    'discrepancy_detected', 'uninvoiced_delivery',
    'defective_batch_match', 'facility_inactive'
  ))
);

-- ============================================================
-- 2. manual_context enum
-- ============================================================
DO $$ BEGIN
  CREATE TYPE manual_context AS ENUM ('client', 'prison');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 3. manual_pages table
-- ============================================================
CREATE TABLE IF NOT EXISTS manual_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context manual_context NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content_md TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(context, slug)
);

-- ============================================================
-- 4. manual_page_versions table
-- ============================================================
CREATE TABLE IF NOT EXISTS manual_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_page_id UUID NOT NULL REFERENCES manual_pages(id) ON DELETE CASCADE,
  content_md TEXT NOT NULL,
  saved_by UUID REFERENCES users(id),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. ENABLE + FORCE RLS
--    FORCE ensures even the table owner (superuser bypass) is denied.
-- ============================================================
ALTER TABLE notification_mute_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_mute_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE manual_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_pages FORCE ROW LEVEL SECURITY;
ALTER TABLE manual_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_page_versions FORCE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS policies on notification_mute_preferences
-- ============================================================

-- Default deny: restrictive USING(false) — fail-closed base policy
CREATE POLICY nmp_deny_all ON notification_mute_preferences
  AS RESTRICTIVE FOR ALL
  USING (false);

-- reco-admin: full CRUD
CREATE POLICY nmp_reco_admin_all ON notification_mute_preferences
  AS PERMISSIVE FOR ALL TO reco_admin
  USING (true) WITH CHECK (true);

-- client_role: CRUD own rows
CREATE POLICY nmp_client_select ON notification_mute_preferences
  AS PERMISSIVE FOR SELECT TO client_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY nmp_client_insert ON notification_mute_preferences
  AS PERMISSIVE FOR INSERT TO client_role
  WITH CHECK (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY nmp_client_update ON notification_mute_preferences
  AS PERMISSIVE FOR UPDATE TO client_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY nmp_client_delete ON notification_mute_preferences
  AS PERMISSIVE FOR DELETE TO client_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true));

-- transport_role: CRUD own rows
CREATE POLICY nmp_transport_select ON notification_mute_preferences
  AS PERMISSIVE FOR SELECT TO transport_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY nmp_transport_insert ON notification_mute_preferences
  AS PERMISSIVE FOR INSERT TO transport_role
  WITH CHECK (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY nmp_transport_update ON notification_mute_preferences
  AS PERMISSIVE FOR UPDATE TO transport_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY nmp_transport_delete ON notification_mute_preferences
  AS PERMISSIVE FOR DELETE TO transport_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true));

-- prison_role: CRUD own rows
CREATE POLICY nmp_prison_select ON notification_mute_preferences
  AS PERMISSIVE FOR SELECT TO prison_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY nmp_prison_insert ON notification_mute_preferences
  AS PERMISSIVE FOR INSERT TO prison_role
  WITH CHECK (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY nmp_prison_update ON notification_mute_preferences
  AS PERMISSIVE FOR UPDATE TO prison_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY nmp_prison_delete ON notification_mute_preferences
  AS PERMISSIVE FOR DELETE TO prison_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 7. RLS policies on notifications (extend for client + prison)
--    Existing reco_admin + transport_role policies already exist from initial migration.
-- ============================================================
CREATE POLICY notifications_client_read ON notifications
  AS PERMISSIVE FOR SELECT TO client_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY notifications_client_update_read ON notifications
  AS PERMISSIVE FOR UPDATE TO client_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY notifications_prison_read ON notifications
  AS PERMISSIVE FOR SELECT TO prison_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true));
CREATE POLICY notifications_prison_update_read ON notifications
  AS PERMISSIVE FOR UPDATE TO prison_role
  USING (user_id::text = current_setting('request.jwt.claim.sub', true))
  WITH CHECK (user_id::text = current_setting('request.jwt.claim.sub', true));

-- ============================================================
-- 8. RLS policies on manual_pages
-- ============================================================

-- Default deny: restrictive USING(false) — fail-closed base policy
CREATE POLICY mp_deny_all ON manual_pages
  AS RESTRICTIVE FOR ALL
  USING (false);

-- reco-admin: full CRUD
CREATE POLICY mp_reco_admin_all ON manual_pages
  AS PERMISSIVE FOR ALL TO reco_admin
  USING (true) WITH CHECK (true);

-- client_role: SELECT published client pages only
CREATE POLICY mp_client_read ON manual_pages
  AS PERMISSIVE FOR SELECT TO client_role
  USING (context = 'client' AND published = true);

-- prison_role: SELECT published prison pages only
CREATE POLICY mp_prison_read ON manual_pages
  AS PERMISSIVE FOR SELECT TO prison_role
  USING (context = 'prison' AND published = true);

-- ============================================================
-- 9. RLS policies on manual_page_versions
-- ============================================================

-- Default deny: restrictive USING(false) — fail-closed base policy
CREATE POLICY mpv_deny_all ON manual_page_versions
  AS RESTRICTIVE FOR ALL
  USING (false);

-- reco-admin: SELECT (read history) and INSERT (create snapshots)
CREATE POLICY mpv_reco_admin_select ON manual_page_versions
  AS PERMISSIVE FOR SELECT TO reco_admin
  USING (true);
CREATE POLICY mpv_reco_admin_insert ON manual_page_versions
  AS PERMISSIVE FOR INSERT TO reco_admin
  WITH CHECK (true);

-- ============================================================
-- 10. Audit log trigger on manual_pages (reuses existing function from 0001)
-- ============================================================
CREATE TRIGGER manual_pages_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON manual_pages
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

-- ============================================================
-- 11. GRANTs
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_mute_preferences TO reco_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_mute_preferences TO client_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_mute_preferences TO transport_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_mute_preferences TO prison_role;
GRANT SELECT, UPDATE ON notifications TO client_role;
GRANT SELECT, UPDATE ON notifications TO prison_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON manual_pages TO reco_admin;
GRANT SELECT ON manual_pages TO client_role;
GRANT SELECT ON manual_pages TO prison_role;
GRANT SELECT, INSERT ON manual_page_versions TO reco_admin;

-- ============================================================
-- 12. Supabase Realtime publication for notifications
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================
-- 13. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_nmp_user_id ON notification_mute_preferences (user_id);
CREATE INDEX IF NOT EXISTS idx_manual_pages_context_published ON manual_pages (context, published);
CREATE INDEX IF NOT EXISTS idx_manual_page_versions_page_id ON manual_page_versions (manual_page_id);
