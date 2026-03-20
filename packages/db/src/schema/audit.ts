import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

// Audit log table — no RLS (accessible only via application queries with reco-admin role)
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    table_name: text('table_name').notNull(),
    record_id: text('record_id').notNull(), // text handles both uuid and text PKs
    tenant_id: text('tenant_id'), // nullable (system tables have no tenant)
    action: text('action').notNull(), // INSERT, UPDATE, DELETE
    old_data: jsonb('old_data'),
    new_data: jsonb('new_data'),
    changed_by: text('changed_by'), // from JWT claim request.jwt.claim.sub
    changed_at: timestamp('changed_at').notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_table_name_record_id_idx').on(t.table_name, t.record_id),
    index('audit_log_changed_at_idx').on(t.changed_at),
  ]
)

// Audit trigger function SQL — applied to all editable tables.
// SECURITY DEFINER ensures the trigger can INSERT into audit_log
// regardless of the calling user's RLS policies.
// This SQL is included in the manual migration 0001_rls_and_triggers.sql.
export const AUDIT_TRIGGER_SQL = `
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, tenant_id, action, old_data, new_data, changed_by)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id::text, OLD.id::text),
    CASE
      WHEN TG_TABLE_NAME = 'system_settings' THEN NULL
      WHEN TG_TABLE_NAME = 'tenants' THEN COALESCE(NEW.id, OLD.id)
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
`
