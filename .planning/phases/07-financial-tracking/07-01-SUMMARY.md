---
phase: 07-financial-tracking
plan: "01"
subsystem: financial
tags: [schema, drizzle, rls, migration, pure-functions, unit-tests]
dependency_graph:
  requires: [intake_records, tenants, users, audit_log_trigger]
  provides: [financial_records, invoiceStatusEnum, calculateInvoiceAmount, assembleTransportCost, formatCurrency]
  affects: [07-02, 07-03]
tech_stack:
  added: [invoice_status enum]
  patterns: [pgEnum, unique FK constraint, SECURITY DEFINER trigger, can_view_financials RLS guard]
key_files:
  created:
    - packages/db/src/schema/financial.ts
    - packages/db/migrations/0006_financial_records.sql
    - apps/web/app/(ops)/financial/actions.ts
    - apps/web/app/(ops)/financial/actions.test.ts
  modified:
    - packages/db/src/schema/index.ts
decisions:
  - "financial_records uses unique() constraint on intake_record_id — enforces 1:1 relationship at DB level; auto-create trigger uses ON CONFLICT DO NOTHING for idempotency"
  - "RLS fail-closed: no policies for clientRole, transportRole, prisonRole — financial data never exposed to non-reco users regardless of future bugs"
  - "reco_read policy guards on can_view_financials via EXISTS subquery on users table — matches AUTH-08 per-user financial visibility toggle"
  - "SECURITY DEFINER on create_financial_record trigger — allows trigger to bypass RLS and insert into financial_records even when session role has no INSERT policy"
  - "formatCurrency uses unicode escapes for euro sign and em dash — avoids encoding issues in TypeScript source files"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-21"
  tasks: 2
  files: 5
---

# Phase 7 Plan 01: Financial Records Schema, Migration, and Pure Functions Summary

Financial records schema with 1:1 intake link, auto-create trigger, fail-closed RLS, and three tested pure calculation/formatting functions that Plans 02 and 03 build UI on top of.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Financial records Drizzle schema, migration SQL with trigger and RLS | b8827ac | financial.ts, index.ts, 0006_financial_records.sql |
| 2 | Pure calculation and formatting functions with unit tests | 7268e45 | actions.ts, actions.test.ts |

## What Was Built

### Task 1: Drizzle Schema and Migration

- `invoiceStatusEnum` with 3 values: `not_invoiced`, `invoiced`, `paid`
- `financialRecords` table with `unique()` constraint on `intake_record_id` (enforces 1:1 with intake_records)
- Columns: id, intake_record_id (unique FK), tenant_id, transport_cost_eur (numeric 12,4), estimated_invoice_amount_eur (numeric 12,4), invoice_status, invoice_number, invoice_date, notes, created_at, updated_at
- 3 indexes: intake_record_id, tenant_id, invoice_status
- 3 RLS policies: `financial_records_deny_all` (restrictive), `financial_records_reco_admin_all` (permissive, full CRUD), `financial_records_reco_read` (permissive SELECT, guarded by `can_view_financials`)
- No policies for clientRole, transportRole, prisonRole — fail-closed
- Migration SQL: CREATE TYPE, CREATE TABLE, 3 indexes, ENABLE + FORCE RLS, 3 policies, GRANTs, auto-create trigger (SECURITY DEFINER), audit trigger

### Task 2: Pure Functions and Server Actions

- `calculateInvoiceAmount`: sum of (quantity * price_eur) for each line + transport cost; handles null pricing gracefully
- `assembleTransportCost`: adds two transport legs; returns null when both are null (unexpected deliveries)
- `formatCurrency`: EUR/DKK conversion with live exchange rate; em dash for null amounts
- `requireRecoAdmin` and `requireFinancialAccess` auth helpers
- 4 stub Server Actions ready for Plan 02: `calculateAndStoreInvoiceAmount`, `getFinancialRecords`, `updateInvoiceFields`, `getUninvoicedAlerts`
- 9 unit tests — all passing

## Verification Results

- `grep -c 'export.*financial' packages/db/src/schema/index.ts` → 1
- `grep 'FORCE ROW LEVEL SECURITY'` → match confirmed
- `grep 'GRANT SELECT ON financial_records TO reco_role'` → match confirmed
- `grep 'CREATE TRIGGER financial_records_audit'` → match confirmed
- `grep 'ON CONFLICT (intake_record_id) DO NOTHING'` → match confirmed
- `grep 'CREATE OR REPLACE FUNCTION create_financial_record'` → match confirmed
- No GRANTs to client_role, transport_role, prison_role (confirmed — only in comments)
- 9 unit tests: PASSED

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

The following stub Server Actions exist intentionally and are tracked for Plan 02:

| File | Stub | Reason |
|------|------|--------|
| apps/web/app/(ops)/financial/actions.ts | `calculateAndStoreInvoiceAmount` returns `{ error: 'Not yet implemented' }` | Requires DB query implementation — Plan 02 |
| apps/web/app/(ops)/financial/actions.ts | `getFinancialRecords` returns `[]` | Requires DB query implementation — Plan 02 |
| apps/web/app/(ops)/financial/actions.ts | `updateInvoiceFields` returns `{ error: 'Not yet implemented' }` | Requires DB mutation implementation — Plan 02 |
| apps/web/app/(ops)/financial/actions.ts | `getUninvoicedAlerts` returns `[]` | Requires DB query implementation — Plan 02 |

These stubs do not prevent Plan 01's goal (data foundation) from being achieved. Plans 02 and 03 will wire all data.

## Self-Check: PASSED

- packages/db/src/schema/financial.ts: FOUND
- packages/db/migrations/0006_financial_records.sql: FOUND
- apps/web/app/(ops)/financial/actions.ts: FOUND
- apps/web/app/(ops)/financial/actions.test.ts: FOUND
- packages/db/src/schema/index.ts modified: FOUND
- Commit b8827ac: FOUND
- Commit 7268e45: FOUND
