---
phase: 10-historical-data-import
plan: "01"
subsystem: db-schema, import-parser
tags: [migration, drizzle, exceljs, papaparse, tdd, csv, xlsx]
dependency_graph:
  requires: []
  provides: [is_imported-columns, import_jobs-table, import-parser-library]
  affects: [pickups, intake_records, processing_reports, financial_records, transport_bookings]
tech_stack:
  added: [exceljs@4.4.0, papaparse, "@types/papaparse"]
  patterns: [TDD-red-green, pgPolicy-rls, drizzle-schema]
key_files:
  created:
    - packages/db/migrations/0009_historical_import.sql
    - packages/db/src/schema/import.ts
    - apps/web/lib/import-parser.ts
    - apps/web/lib/import-parser.test.ts
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/schema/pickups.ts
    - packages/db/src/schema/intake.ts
    - packages/db/src/schema/processing.ts
    - packages/db/src/schema/financial.ts
    - packages/db/src/schema/transport.ts
    - apps/web/package.json
decisions:
  - "parseXlsx uses any cast for exceljs load call — @types/node Buffer<ArrayBufferLike> does not match exceljs index.d.ts Buffer (no generic); parameter widened to Buffer | ArrayBuffer"
  - "import_jobs table uses reco_admin_role GRANT (matching migration SQL) — rls policy uses recoAdminRole pgRole reference from auth.ts"
metrics:
  duration_seconds: 293
  completed_date: "2026-03-21T12:17:22Z"
  tasks_completed: 2
  files_changed: 11
---

# Phase 10 Plan 01: Migration + Schema + Parser Library Summary

**One-liner:** `is_imported` flag on 5 tables + `import_jobs` tracking table + ExcelJS/PapaParse CSV/XLSX parser library with 10 passing unit tests.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Migration SQL + Drizzle schema + library install | 288621d | 0009_historical_import.sql, import.ts, index.ts, pickups/intake/processing/financial/transport.ts, package.json |
| 2 (RED) | TDD failing tests for import-parser | 98f1377 | import-parser.test.ts |
| 2 (GREEN) | Implement CSV and XLSX parser library | 043f37b | import-parser.ts |
| 2 (fix) | Fix Buffer generic type mismatch in parseXlsx | b2ed347 | import-parser.ts |

## What Was Built

### Migration (0009_historical_import.sql)
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT false` on all 5 importable tables: pickups, intake_records, processing_reports, financial_records, transport_bookings
- `CREATE TABLE import_jobs` with full schema for preview-then-commit workflow: source, target_tenant_id, status, file_name, total_rows, valid_rows, error_count, rows_json, errors_json, column_mapping_json, created_by, committed_at, timestamps
- ENABLE + FORCE ROW LEVEL SECURITY, reco_admin_role permissive policy, GRANT SELECT/INSERT/UPDATE

### Drizzle Schema (packages/db/src/schema/import.ts)
- `importJobs` pgTable mirroring the migration
- RLS policy `import_jobs_reco_admin_all` (permissive, recoAdminRole, all operations)
- Re-exported from index.ts

### is_imported Column in Existing Schemas
- Added `is_imported: boolean('is_imported').notNull().default(false)` to all 5 existing table definitions
- Added `boolean` import to pickups.ts and financial.ts where it was missing

### Parser Library (apps/web/lib/import-parser.ts)
- `parseCsv(content: string)` — PapaParse with header trimming and empty row skipping
- `parseXlsx(buffer: Buffer | ArrayBuffer)` — ExcelJS workbook load, row 1 as headers, Date/Formula cell type handling
- `parseFile(buffer, fileName)` — unified entry point dispatching on `.csv`, `.xlsx`/`.xls` extensions; throws `Unsupported file type: {ext}` for others

### Tests (apps/web/lib/import-parser.test.ts)
- 10 tests across 4 describe blocks: parseCsv (4), parseXlsx (2), parseFile (4)
- All 10 pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript Buffer generic type mismatch in parseXlsx**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** `@types/node` 22.x uses generic `Buffer<ArrayBufferLike>` which does not satisfy exceljs `index.d.ts` `Buffer` parameter type (no generic)
- **Fix:** Widened `parseXlsx` parameter to `Buffer | ArrayBuffer`; used `as any` cast for the `workbook.xlsx.load()` call
- **Files modified:** `apps/web/lib/import-parser.ts`
- **Commit:** b2ed347

## Known Stubs

None — no UI stubs in this plan. Parser library returns real data from real files.

## Self-Check: PASSED
