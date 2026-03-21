---
phase: 10-historical-data-import
verified: 2026-03-21T13:50:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to /import as reco-admin, verify 5 source cards visible"
    expected: "Page renders with 5 clickable source cards showing pickup_log, intake_log, greenloop, invoice_binder, transport_costs"
    why_human: "Server component rendering and CSS layout cannot be verified programmatically"
  - test: "Upload a small intake CSV, map columns, preview errors, commit"
    expected: "Multi-step wizard transitions through all 4 steps; committed record appears with blue Imported badge in /intake list"
    why_human: "End-to-end browser flow with FormData file upload cannot be automated via grep"
  - test: "Attempt to re-commit an already-committed job (e.g. navigate back and click Commit again)"
    expected: "Server Action throws 'Job already committed' and UI shows error"
    why_human: "Runtime guard cannot be verified statically"
  - test: "Download ESG CSV export after committing imported intake records"
    expected: "Export totals include the imported records (imported records not filtered out)"
    why_human: "Requires live data and export download to verify end-to-end"
---

# Phase 10: Historical Data Import — Verification Report

**Phase Goal:** All historical operational data (2022-2026) is imported, flagged as imported records, and fully queryable in dashboards and reports from day one of live operations

**Verified:** 2026-03-21T13:50:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `is_imported` boolean column exists on all five importable DB tables | VERIFIED | `grep` confirms `is_imported: boolean('is_imported').notNull().default(false)` in pickups.ts, intake.ts, processing.ts, financial.ts, transport.ts |
| 2 | `import_jobs` table stores parsed rows and validation errors for preview-then-commit workflow | VERIFIED | `packages/db/migrations/0009_historical_import.sql` creates the table; `packages/db/src/schema/import.ts` mirrors it in Drizzle with RLS |
| 3 | CSV and XLSX files are parsed server-side with correct header extraction | VERIFIED | `apps/web/lib/import-parser.ts` exports `parseCsv`, `parseXlsx`, `parseFile`; 110-line test file with 10+ tests |
| 4 | Five Zod schemas validate per-source row data with clear field-level error messages | VERIFIED | `apps/web/lib/import-validators.ts` exports all five schemas plus `validateRows`, `applyColumnMapping`, `resolveForeignKeys`; 257-line test file |
| 5 | reco-admin can upload a file and see parsed headers, map columns, preview errors, then commit | VERIFIED | Upload API route `app/api/import/upload/route.ts` parses file, builds FK lookups, validates, inserts import_jobs; 561-line wizard handles all 4 steps |
| 6 | Committed import inserts valid rows into target tables with `is_imported=true` | VERIFIED | `actions.ts` switch covers all 5 sources; each insert sets `is_imported: true`; `invoice_binder` correctly uses UPDATE |
| 7 | A committed job cannot be re-committed | VERIFIED | `commitImport` throws `'Job already committed'` when `job.status === 'committed'` before any insert logic |
| 8 | Imported records display a blue "Imported" badge in all list views | VERIFIED | Confirmed in: `intake-queue-table.tsx`, `pickups/page.tsx`, `processing/pipeline-card.tsx`, `financial/page.tsx`, `transport/outbound/page.tsx` — all use `bg-blue-100 text-blue-800 border-blue-200` |
| 9 | ESG/dashboard aggregates include imported records (no is_imported exclusion filter) | VERIFIED | Grep of `esg/`, `dashboard/`, `esg-calculator.ts` returns zero `is_imported.*false` matches |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/migrations/0009_historical_import.sql` | is_imported on 5 tables + import_jobs with RLS | VERIFIED | All 5 ALTER TABLE statements + CREATE TABLE + FORCE ROW LEVEL SECURITY + reco_admin_role policy |
| `packages/db/src/schema/import.ts` | Drizzle schema for import_jobs | VERIFIED | Exports `importJobs`; pgPolicy `import_jobs_reco_admin_all`; re-exported via index.ts |
| `packages/db/src/schema/index.ts` | Re-exports import schema | VERIFIED | `export * from './import'` at line 17 |
| `apps/web/lib/import-parser.ts` | parseXlsx and parseCsv functions | VERIFIED | Exports `parseCsv`, `parseXlsx`, `parseFile`; uses ExcelJS and PapaParse; handles Date/Formula cells |
| `apps/web/lib/import-parser.test.ts` | Unit tests (min 40 lines) | VERIFIED | 110 lines, 10 tests across 4 describe blocks |
| `apps/web/lib/import-validators.ts` | Five Zod schemas + validateRows + helpers | VERIFIED | All five schemas exported; `validateRows`, `applyColumnMapping`, `resolveForeignKeys`, `getSchemaForSource` |
| `apps/web/lib/import-validators.test.ts` | Unit tests (min 80 lines) | VERIFIED | 257 lines, 20 test cases |
| `apps/web/lib/import-sources.ts` | IMPORT_SOURCES registry | VERIFIED | Exports `ImportSourceId`, `ImportSourceField`, `ImportSource`, `IMPORT_SOURCES` with all 5 sources |
| `apps/web/app/api/import/upload/route.ts` | POST endpoint for file upload + parse + validate + store | VERIFIED | Exports POST; reco-admin auth check; calls parseFile, applyColumnMapping, resolveForeignKeys, validateRows; inserts import_jobs; returns jobId/headers/errors |
| `apps/web/app/(ops)/import/page.tsx` | Import hub with 5 source cards | VERIFIED | 88 lines; reco-admin guard; renders 5 cards from `Object.values(IMPORT_SOURCES)` with `/import/${source.id}` links |
| `apps/web/app/(ops)/import/[source]/import-wizard.tsx` | Multi-step wizard (min 100 lines) | VERIFIED | 561 lines; `'use client'`; 4-step state machine (upload, mapping, preview, committed); auto-mapping; commit wired to Server Action |
| `apps/web/app/(ops)/import/[source]/actions.ts` | commitImport + getImportJob Server Actions | VERIFIED | `'use server'`; exports both; re-commit guard; all 5 source cases with is_imported=true; withRLSContext; revalidatePath |
| `apps/web/app/(ops)/intake/components/intake-queue-table.tsx` | Imported badge | VERIFIED | `intake.is_imported` conditional renders blue badge |
| `apps/web/app/(ops)/pickups/page.tsx` | Imported badge | VERIFIED | `pickup.is_imported` conditional renders blue badge; `is_imported` selected in actions.ts |
| `apps/web/app/(ops)/processing/pipeline-card.tsx` | Imported badge via isImported prop | VERIFIED | `isImported` prop renders blue badge; wired from `processing/page.tsx` via `item.is_imported` |
| `apps/web/app/(ops)/financial/page.tsx` | Imported badge | VERIFIED | `record.is_imported` conditional renders blue badge |
| `apps/web/app/(ops)/transport/outbound/page.tsx` | Imported badge | VERIFIED | `pickup.is_imported` conditional renders blue badge (transport/page.tsx does not exist; outbound is the correct target view) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `import-wizard.tsx` | `/api/import/upload` | fetch POST with FormData | WIRED | Lines 161 and 203 both call `fetch('/api/import/upload', { method: 'POST', body: fd })` |
| `import-wizard.tsx` | `import-sources.ts` | `source.fields`, `source.lineFields` | WIRED | Props typed as `ImportSource`; lines 130, 185, 354 use fields arrays |
| `actions.ts` | `packages/db/src/schema/import.ts` | Drizzle select/update on importJobs | WIRED | importJobs imported at line 7; used in getImportJob and commitImport |
| `actions.ts` | `packages/db/src/schema/pickups.ts` | pickupLines insert for line items | WIRED | pickupLines imported at line 9; used at line 111 |
| `actions.ts` | `packages/db/src/schema/intake.ts` | intakeLines insert for line items | WIRED | intakeLines imported at line 11; used at line 145 |
| `upload/route.ts` | `import-parser.ts` | parseFile call | WIRED | `parseFile` imported and called at line 42 |
| `upload/route.ts` | `import-validators.ts` | validateRows + applyColumnMapping + resolveForeignKeys | WIRED | All three imported and called in order |
| `packages/db/src/schema/index.ts` | `packages/db/src/schema/import.ts` | re-export | WIRED | `export * from './import'` at line 17 |
| `ops-nav-bar.tsx` | `/import` | reco-admin nav item | WIRED | `RECO_ADMIN_NAV_ITEMS = [{ label: 'Import', href: '/import' }]` conditionally included for `role === 'reco-admin'` |

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| IMPORT-01 | 10-01, 10-02, 10-03, 10-05 | CSV/XLSX import for 5 sources | SATISFIED | parseFile handles .csv/.xlsx; 5 source definitions in IMPORT_SOURCES; upload API route processes all 5 |
| IMPORT-02 | 10-01, 10-02, 10-03, 10-05 | File upload, column mapping, validation preview, one-click commit | SATISFIED | 4-step wizard implements all four steps; validation errors shown with row+field before any DB write; commitImport performs bulk insert |
| IMPORT-03 | 10-01, 10-04, 10-05 | Records marked and distinguishable in all views and exports | SATISFIED | `is_imported boolean` column on all 5 tables; blue badge in all 5 list views; no is_imported exclusion in ESG/dashboard export paths. Note: REQUIREMENTS.md says `source: 'import'` flag but RESEARCH.md records explicit design decision to use `is_imported boolean` — functionally equivalent and a superset of the requirement. |
| IMPORT-04 | 10-03, 10-05 | One-time import; no ongoing sync | SATISFIED | `commitImport` throws `'Job already committed'` on re-commit; import_jobs status field tracks committed state |

**Orphaned requirements:** None — all four IMPORT-0X IDs appear in plans and are accounted for.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `actions.ts` line 77 | `as Record<string, any>[]` cast on `JSON.parse(job.rows_json)` | Info | Acceptable — rows are untyped JSON from DB text column; explicit any acknowledges the boundary |
| `upload/route.ts` line 103 | `schema as any` cast for `validateRows` | Info | Required by TypeScript union narrowing on Zod schema types; does not affect runtime correctness |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments. No empty return stubs.

---

### Human Verification Required

#### 1. Import Hub Page Rendering

**Test:** Log in as reco-admin, navigate to `/import` via the ops nav bar
**Expected:** Page shows 5 source cards (Pickup Request Log, Prison Intake Log, GreenLoop Processing Reports, Invoice Binder, Transport Costs Spreadsheet), each with a "Start Import" link
**Why human:** Server component rendering and CSS card layout cannot be verified via static analysis

#### 2. Complete Import Wizard Flow

**Test:** Click a source card (e.g. Prison Intake Log), select a tenant, upload a small test CSV with columns: facility_name, staff_name, delivery_date. Step through column mapping, click "Preview Validation", observe errors if any, commit valid rows.
**Expected:** All 4 steps transition correctly; committed records appear in the intake list view with blue "Imported" badge
**Why human:** FormData file upload, multi-step React state machine, and DB insert require a live browser session

#### 3. Re-commit Prevention

**Test:** After committing a job, navigate back to the same import URL with `?jobId={id}` and attempt to commit again
**Expected:** Server Action returns an error ("Job already committed"); UI shows error message
**Why human:** Runtime guard execution path requires a live committed job

#### 4. ESG Export Includes Imported Records

**Test:** After importing intake records, download the ESG CSV export from `/esg/export`
**Expected:** Imported intake records contribute to ESG totals in the CSV
**Why human:** Requires live data with known quantities to verify the numbers are correct

---

### Gaps Summary

No gaps. All 9 observable truths are verified. All artifacts exist, are substantive, and are wired. All four IMPORT requirements are satisfied.

The one design divergence to note: REQUIREMENTS.md describes IMPORT-03 as `source: 'import'` flag, but the implementation uses `is_imported: boolean`. This was an explicit design decision recorded in `10-RESEARCH.md` (Pattern 3: is_imported Flag) — the boolean approach mirrors the existing `is_unexpected` pattern and is functionally equivalent for the purpose of distinguishing imported from live records.

---

_Verified: 2026-03-21T13:50:00Z_
_Verifier: Claude (gsd-verifier)_
