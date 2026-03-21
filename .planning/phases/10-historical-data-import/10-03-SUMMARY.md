---
phase: 10-historical-data-import
plan: "03"
subsystem: import-ui
tags: [import, file-upload, wizard, server-action, reco-admin]
dependency_graph:
  requires: [10-01, 10-02]
  provides: [import-ui, upload-api, commit-action]
  affects: [pickups, intake_records, processing_reports, financial_records, transport_bookings, import_jobs]
tech_stack:
  added: []
  patterns:
    - "Multi-step client wizard with fetch POST to API route"
    - "AnyImportSchema cast to any for validateRows generic union"
    - "withRLSContext for all domain table inserts in commitImport"
    - "UPDATE-first pattern for transport_costs (upsert without unique constraint)"
key_files:
  created:
    - apps/web/app/api/import/upload/route.ts
    - apps/web/app/(ops)/import/page.tsx
    - apps/web/app/(ops)/import/[source]/page.tsx
    - apps/web/app/(ops)/import/[source]/import-wizard.tsx
    - apps/web/app/(ops)/import/[source]/actions.ts
  modified:
    - apps/web/app/(ops)/ops-nav-bar.tsx
    - apps/web/app/(ops)/layout.tsx
decisions:
  - "OpsNavBar receives role prop from layout — keeps nav bar as client component without needing its own auth() call; layout already has session from requireAuth"
  - "AnyImportSchema cast to any for validateRows — union type prevents TypeScript inference; eslint-disable comment documents intentional suppression"
  - "Transport costs uses SELECT-then-UPDATE-or-INSERT pattern — transportBookings has no unique constraint on pickup_id usable with onConflictDoUpdate; explicit select avoids silent overwrites"
  - "commitImport does not use is_imported check on greenloop/invoice_binder — processingReports has no unique constraint for idempotency; invoice_binder uses UPDATE which is idempotent by nature"
metrics:
  duration_minutes: 5
  tasks_completed: 3
  files_created: 5
  files_modified: 2
  completed_date: "2026-03-21"
---

# Phase 10 Plan 03: Import UI and Backend Summary

**One-liner:** Multi-step import wizard (upload → map columns → preview validation → commit) with per-source bulk insert Server Action for all five historical data sources.

## What Was Built

### Task 1: Upload API Route + Import Hub Page + Nav Link

**`apps/web/app/api/import/upload/route.ts`** — POST endpoint that:
- Authenticates as reco-admin (403 if not)
- Parses CSV/XLSX via `parseFile`
- Optionally applies column mapping via `applyColumnMapping`
- Builds FK lookup maps (facilities, products, locations; conditionally intake references, pickup references, providers)
- Resolves FKs via `resolveForeignKeys`, validates via `validateRows`
- Inserts an `import_jobs` record with status `ready` or `has_errors`
- Returns `{ jobId, totalRows, validRows, errorCount, errors, headers }`

**`apps/web/app/(ops)/import/page.tsx`** — Import hub Server Component with 5 source cards (pickup_log, intake_log, greenloop, invoice_binder, transport_costs), each showing name, description, target table, date range, and a "Start Import" link.

**`apps/web/app/(ops)/ops-nav-bar.tsx`** — Import link added to `RECO_ADMIN_NAV_ITEMS`, conditionally rendered when `role === 'reco-admin'`. Layout passes `role` prop from session.

### Task 2: Import Wizard Client Component

**`apps/web/app/(ops)/import/[source]/import-wizard.tsx`** — `'use client'` component with 4-step flow:
- **Upload:** Tenant selector, file input (.csv/.xlsx), "Upload & Parse" button
- **Column Mapping:** Table of platform fields → spreadsheet header dropdowns; auto-mapping on mount by case-insensitive header match; required field badges; "Use Default Mapping" button; "Preview Validation" button (enabled when all required fields mapped)
- **Validation Preview:** Summary banner (all valid / partial / none); scrollable error table (max 100 rows, "and N more…" truncation); "Commit Import" and "Re-upload" buttons
- **Committed:** Success banner with imported count, job ID, and link back to hub

**`apps/web/app/(ops)/import/[source]/page.tsx`** — Server Component that validates source param against IMPORT_SOURCES, redirects to /import if invalid, queries tenants and optional existing job, renders ImportWizard.

### Task 3: commitImport Server Action

**`apps/web/app/(ops)/import/[source]/actions.ts`** — `'use server'`:
- `getImportJob(jobId)`: reco-admin only, returns job by id
- `commitImport(jobId)`: re-commit guard (`status === 'committed'` throws; `status !== 'ready'` throws)

Per-source insert logic using `withRLSContext`:
- **pickup_log:** INSERT into `pickups` with `is_imported: true` + INSERT `pickupLines` per row.lines
- **intake_log:** INSERT into `intakeRecords` with `is_imported: true` + INSERT `intakeLines` per row.lines
- **greenloop:** INSERT into `processingReports` with `is_imported: true`
- **invoice_binder:** UPDATE `financialRecords` (not insert — trigger already created record from intake import)
- **transport_costs:** SELECT existing by pickup_id → UPDATE if found, INSERT if not

All cases use `.onConflictDoNothing()` on inserts for idempotency safety. Updates `import_jobs.status` to `'committed'` and calls `revalidatePath('/import')`.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files created:
- apps/web/app/api/import/upload/route.ts — exists
- apps/web/app/(ops)/import/page.tsx — exists
- apps/web/app/(ops)/import/[source]/page.tsx — exists
- apps/web/app/(ops)/import/[source]/import-wizard.tsx — exists
- apps/web/app/(ops)/import/[source]/actions.ts — exists

Commits:
- 9a1b0d7 — Task 1
- 0e32df0 — Task 2
- 41fb7c8 — Task 3
