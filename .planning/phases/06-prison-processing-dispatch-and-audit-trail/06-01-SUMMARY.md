---
phase: 06-prison-processing-dispatch-and-audit-trail
plan: "01"
subsystem: database-schema
tags: [migration, rls, audit, processing, dispatch]
dependency_graph:
  requires:
    - "packages/db/migrations/0001_rls_and_triggers.sql (audit_log_trigger function)"
    - "packages/db/migrations/0004_intake_trigger_rls.sql (intake_records table)"
    - "packages/db/src/schema/products.ts (products table)"
  provides:
    - "0005_phase6_processing_dispatch_audit.sql — all Phase 6 DDL"
    - "processing_reports, processing_report_lines tables"
    - "outbound_dispatches, outbound_dispatch_lines tables"
    - "activity_type, size_bucket, dispatch_status, product_category enums"
    - "voided/void_reason columns on intake_records"
    - "product_category column on products"
    - "computeFieldDiff, isRecordEdited pure helper functions"
  affects:
    - "packages/db/src/schema/intake.ts (voided columns, prison UPDATE policy)"
    - "apps/web/lib/audit-helpers.ts (new pure helper library)"
tech_stack:
  added: []
  patterns:
    - "Single migration file per phase (0005_phase6_processing_dispatch_audit.sql)"
    - "audit_log_trigger() reused generically — no modification needed for new tables"
    - "TDD Red-Green pattern for pure TypeScript helper functions"
key_files:
  created:
    - "packages/db/migrations/0005_phase6_processing_dispatch_audit.sql"
    - "apps/web/lib/audit-helpers.ts"
    - "apps/web/lib/audit-helpers.test.ts"
  modified:
    - "packages/db/src/schema/intake.ts"
decisions:
  - "audit_log_trigger() referenced via CREATE TRIGGER without redefinition — existing SECURITY DEFINER function from 0001 handles all tables generically"
  - "computeFieldDiff returns empty array for both INSERT (null old_data) and DELETE (null new_data) — only UPDATE produces meaningful diffs"
  - "IGNORED_FIELDS = ['updated_at'] — filtered from diffs to reduce noise in audit display"
metrics:
  duration_seconds: 164
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 06 Plan 01: Phase 6 Migration SQL and Audit Helper Library Summary

**One-liner:** Single Phase 6 migration SQL with all DDL (4 enums, 4 tables, audit triggers, RLS, GRANTs) plus pure TypeScript computeFieldDiff/isRecordEdited helpers with 12 passing unit tests.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Complete Phase 6 migration SQL and intake schema update | 4c59555 | packages/db/migrations/0005_phase6_processing_dispatch_audit.sql, packages/db/src/schema/intake.ts |
| 2 (RED) | Add failing tests for audit helper functions | cefc81b | apps/web/lib/audit-helpers.test.ts |
| 2 (GREEN) | Implement audit helper library | 164ccb2 | apps/web/lib/audit-helpers.ts |

## What Was Built

### Migration: 0005_phase6_processing_dispatch_audit.sql

A single SQL file containing all Phase 6 DDL in 10 logical sections:

1. **New enums:** `activity_type` ('wash', 'pack'), `size_bucket` (XXS–XXXL), `dispatch_status` ('created', 'picked_up', 'delivered'), `product_category` ('clothing', 'bag', 'equipment', 'other')

2. **ALTER existing tables:** Added `voided boolean NOT NULL DEFAULT false` and `void_reason text` to `intake_records` (AUDIT-04); added `product_category product_category NOT NULL DEFAULT 'other'` to `products` with Wolt seed data (Clothing → 'clothing', Bag → 'bag', Heating Plate → 'equipment')

3. **processing_reports table:** Records Wash/Pack activities at a prison facility, linked to intake_record and product; includes voided/void_reason columns

4. **processing_report_lines table:** Per-size-bucket quantity breakdown for clothing processing; cascades on processing_report deletion

5. **outbound_dispatches table:** Dispatches of clothing to redistribution partner with status tracking (created → picked_up → delivered)

6. **outbound_dispatch_lines table:** Per-product/per-size-bucket line items with SKU codes; cascades on dispatch deletion

7. **ENABLE + FORCE RLS:** Applied to all 4 new tables (8 ALTER statements total)

8. **GRANTs:** prison_role gets SELECT/INSERT/UPDATE on processing_reports, SELECT/INSERT on processing_report_lines, SELECT on outbound tables, and newly gains UPDATE on intake_records; reco_role gets SELECT on all new tables; reco_admin_role gets ALL

9. **Audit triggers:** `audit_intake_records`, `audit_processing_reports`, `audit_outbound_dispatches` — all reference the existing `audit_log_trigger()` SECURITY DEFINER function from migration 0001

10. **Prison UPDATE RLS policy:** `intake_records_prison_update` using `prison_facility_id::text = current_setting('request.jwt.claim.facility_id', true)` for both USING and WITH CHECK

### Drizzle Schema: packages/db/src/schema/intake.ts

- Added `voided: boolean('voided').notNull().default(false)` column after `quarantine_overridden_at`
- Added `void_reason: text('void_reason')` column after `voided`
- Added `pgPolicy('intake_records_prison_update', ...)` to policies array matching the SQL migration policy

### Audit Helper Library: apps/web/lib/audit-helpers.ts

Pure TypeScript functions for processing audit_log entries in UI components:

- **`AuditEntry` interface:** Matches audit_log table structure (id, action, old_data, new_data as Record, changed_by, changed_at)
- **`FieldDiff` interface:** `{ field: string, old: string, new: string }`
- **`computeFieldDiff(entry)`:** Compares old_data vs new_data key-by-key, returns changed fields excluding `IGNORED_FIELDS = ['updated_at']`; returns `[]` for INSERT (null old_data) and DELETE (null new_data)
- **`isRecordEdited(entries)`:** Returns true only if any entry has `action === 'UPDATE'`

### Tests: apps/web/lib/audit-helpers.test.ts

12 unit tests across 2 describe blocks — all passing:

**computeFieldDiff (7 tests):**
- Returns changed fields
- Returns empty for INSERT (null old_data)
- Ignores updated_at changes
- Handles multiple changed fields
- Converts values to strings via String()
- Returns empty when no changes
- Returns empty for DELETE (null new_data)

**isRecordEdited (5 tests):**
- Returns false for empty array
- Returns true for UPDATE
- Returns false for INSERT only
- Returns false for DELETE only
- Returns true when UPDATE among multiple entries

## Decisions Made

1. **audit_log_trigger() referenced, not redefined** — The existing `SECURITY DEFINER` function from `0001_rls_and_triggers.sql` handles all tables generically via `TG_TABLE_NAME`. No modification needed; new tables are simply wired up via `CREATE TRIGGER ... EXECUTE FUNCTION audit_log_trigger()`.

2. **computeFieldDiff returns [] for DELETE** — The plan specified INSERT returns empty; DELETE is also empty (new_data is null). Both cases produce no meaningful diff. This is a safe extension of the plan's intent.

3. **IGNORED_FIELDS as module constant** — `['updated_at']` defined at module level for easy extension if other noise fields are identified.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — migration SQL and helper functions are complete and correct. The new tables have no Drizzle schema definitions in this plan (those come in Plans 04/07 per phase structure), but that is intentional — this plan's scope is migration SQL only.

## Self-Check: PASSED

- `packages/db/migrations/0005_phase6_processing_dispatch_audit.sql` — exists
- `apps/web/lib/audit-helpers.ts` — exists
- `apps/web/lib/audit-helpers.test.ts` — exists
- Commits 4c59555, cefc81b, 164ccb2 — all present in git log
- 12 tests — all passing
