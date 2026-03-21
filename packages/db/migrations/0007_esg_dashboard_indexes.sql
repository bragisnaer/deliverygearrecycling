-- Phase 8: Composite indexes for ESG temporal joins and dashboard aggregations
-- Supports DASH-06 (<2s load for 50k records) and ESG-05 (temporal composition join)

-- ESG temporal composition join: intake_records scanned by tenant + delivery date
CREATE INDEX IF NOT EXISTS intake_records_tenant_delivery_date_idx
  ON intake_records(tenant_id, delivery_date)
  WHERE voided = false;

-- ESG temporal composition join: product_materials scanned by product + effective date window
CREATE INDEX IF NOT EXISTS product_materials_product_effective_idx
  ON product_materials(product_id, effective_from, effective_to);

-- ESG: intake_lines scanned by product_id for material weight lookup
CREATE INDEX IF NOT EXISTS intake_lines_product_id_idx
  ON intake_lines(product_id);

-- Processing reuse rate: processing_reports filtered by tenant + voided
CREATE INDEX IF NOT EXISTS processing_reports_tenant_voided_idx
  ON processing_reports(tenant_id, voided);

-- Dashboard: pickups filtered by status for status summary (DASH-01)
CREATE INDEX IF NOT EXISTS pickups_status_tenant_idx
  ON pickups(status, tenant_id);

-- Dashboard: financial_records filtered by invoice_status for revenue summary (DASH-01)
-- Note: financial_records_invoice_status_idx created in 0006_financial_records.sql; IF NOT EXISTS is safe
CREATE INDEX IF NOT EXISTS financial_records_invoice_status_idx
  ON financial_records(invoice_status);

-- Dashboard: intake_records by prison_facility_id for pipeline view (DASH-01)
-- (intake_records_prison_facility_id_idx already exists from Phase 5 schema — IF NOT EXISTS is safe)

-- Client dashboard: pickups by location_id for client-scoped queries (DASH-03)
CREATE INDEX IF NOT EXISTS pickups_location_id_idx
  ON pickups(location_id);

-- Client dashboard: intake_records by delivery_date for quarterly volume (DASH-03)
CREATE INDEX IF NOT EXISTS intake_records_delivery_date_idx
  ON intake_records(delivery_date)
  WHERE voided = false;
