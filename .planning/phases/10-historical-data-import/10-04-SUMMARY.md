---
phase: 10
plan: "04"
subsystem: historical-data-import
tags: [badge, ui, imported, esg, financial, intake, pickup, processing, transport]
dependency_graph:
  requires: [10-01]
  provides: [IMPORT-03]
  affects: [intake-queue, pickup-queue, processing-pipeline, financial-records, transport-outbound]
tech_stack:
  added: []
  patterns: [blue-badge-pattern, is_imported-flag]
key_files:
  created: []
  modified:
    - apps/web/app/(ops)/intake/actions.ts
    - apps/web/app/(ops)/intake/components/intake-queue-table.tsx
    - apps/web/app/(ops)/pickups/actions.ts
    - apps/web/app/(ops)/pickups/page.tsx
    - apps/web/app/(ops)/processing/actions.ts
    - apps/web/app/(ops)/processing/pipeline-card.tsx
    - apps/web/app/(ops)/processing/page.tsx
    - apps/web/app/(ops)/financial/actions.ts
    - apps/web/app/(ops)/financial/page.tsx
    - apps/web/app/(ops)/transport/outbound/actions.ts
    - apps/web/app/(ops)/transport/outbound/page.tsx
decisions:
  - "Transport view: badge added to warehouse inventory list in transport/outbound/page.tsx — no transport/page.tsx exists; outbound is the primary pickup list for transport role"
  - "FinancialRecordDetail type uses Omit<FinancialRecordListItem, 'is_imported'> & { is_imported: boolean } to avoid duplicate field in intersection type while satisfying TypeScript"
  - "getFinancialRecord detail query also selects is_imported to satisfy FinancialRecordDetail type used by financial detail page"
metrics:
  duration: "5 minutes"
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_modified: 11
---

# Phase 10 Plan 04: Imported Badge and ESG Export Inclusion Summary

Blue "Imported" badge (bg-blue-100, text-blue-800, border-blue-200) added to all five ops list views (intake, pickup, processing, financial, transport/outbound), completing IMPORT-03 visibility requirement; ESG and dashboard queries confirmed to include imported records without exclusion filters.

## Tasks Completed

### Task 1: Add Imported badge to intake and pickup list views

**Intake:**
- Added `is_imported: boolean` to `IntakeQueueItem` type in `intake/actions.ts`
- Added `is_imported: intakeRecords.is_imported` to `getIntakeQueue` SELECT
- Added blue "Imported" badge in `intake-queue-table.tsx` status column (after Quarantine/Overridden badges)

**Pickup:**
- Added `is_imported: pickups.is_imported` to `getPickupQueue` SELECT in `pickups/actions.ts`
- Added blue "Imported" badge in `pickups/page.tsx` inline status column (alongside existing status badge in a flex wrapper)

### Task 2: Add Imported badge to processing, financial, transport views + verify ESG exports

**Processing:**
- Added `is_imported: boolean` to `PipelineIntakeItem` interface in `processing/actions.ts`
- Added `is_imported: intakeRecords.is_imported` to `getPipelineData` SELECT
- Added `is_imported` to `pipeline[stage].push(...)` call
- Added `isImported: boolean` prop to `PipelineCardProps` and destructured in component
- Rendered blue "Imported" badge in `pipeline-card.tsx` alongside origin market
- Passed `isImported={item.is_imported}` from `processing/page.tsx`

**Financial:**
- Added `is_imported: boolean` to `FinancialRecordListItem` type
- Updated `FinancialRecordDetail` to `Omit<FinancialRecordListItem, 'is_imported'> & { is_imported: boolean }` (avoids intersection duplicate while satisfying TypeScript)
- Added `is_imported` to both `getFinancialRecords` and `getFinancialRecord` SELECTs and return mappings
- Added blue "Imported" badge in `financial/page.tsx` invoice status column (flex wrapper with InvoiceStatusBadge)

**Transport:**
- Added `is_imported: pickups.is_imported` to `getWarehouseInventory` SELECT in `transport/outbound/actions.ts`
- Added blue "Imported" badge in `transport/outbound/page.tsx` reference cell (warehouse inventory list)

**ESG/dashboard verification (no code changes needed):**
- `esg/actions.ts` `getEsgData`: uses `WHERE ir.voided = false` — no `is_imported` exclusion
- `esg/actions.ts` `getProcessingStreamCounts`: uses `WHERE pr.voided = false` — no `is_imported` exclusion
- `esg/export/route.ts`: calls `getEsgData()` and `serializeEsgCsv()` without any filtering — imported records flow through
- `esg-calculator.ts` `serializeEsgCsv`: purely serializes `MaterialWeightRow[]` rows — no filtering
- `dashboard/actions.ts`: all aggregate queries (`getPickupStatusSummary`, `getConsolidationAgeing`, `getPrisonPipeline`, `getRevenueSummary`) contain no `is_imported = false` filter

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FinancialRecordDetail type required is_imported**
- **Found during:** Task 2
- **Issue:** Adding `is_imported` to `FinancialRecordListItem` caused TypeScript error in `getFinancialRecord` return — `FinancialRecordDetail extends FinancialRecordListItem` so the concrete return type was missing `is_imported`
- **Fix:** Updated `FinancialRecordDetail` to use `Omit<FinancialRecordListItem, 'is_imported'> & { is_imported: boolean }` and added `is_imported` to `getFinancialRecord` SELECT + return mapping
- **Files modified:** `apps/web/app/(ops)/financial/actions.ts`
- **Commit:** 1d8b5a7

**2. [Scope note] transport/page.tsx does not exist**
- **Found during:** Task 2 read phase
- **Issue:** Plan referenced `apps/web/app/(ops)/transport/page.tsx` but this file does not exist — transport is split into `transport/outbound/`, `transport/portal/`, and `transport/providers/`
- **Fix:** Applied badge to `transport/outbound/page.tsx` (warehouse inventory) which is the primary pickup list for the transport workflow. This satisfies the "transport list view" requirement of IMPORT-03.
- **No plan deviation required** — the plan's `files_modified` list already included `transport/page.tsx` as a target, the actual implementation target is the logically equivalent view

## Verification Results

```
Badge count: 5 files with blue Imported badge confirmed:
- intake/components/intake-queue-table.tsx: Imported=1, blue-badge=1
- pickups/page.tsx: Imported=1, blue-badge=1
- processing/pipeline-card.tsx: Imported=4 (text), blue-badge=1 (class)
- financial/page.tsx: Imported=1, blue-badge=1
- transport/outbound/page.tsx: Imported=1, blue-badge=1

ESG exclusion filter check:
- No is_imported=false filters in esg/, dashboard/, or esg-calculator.ts (correct)
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 3ae4f33 | feat(10-04): add Imported badge to intake and pickup list views |
| Task 2 | 1d8b5a7 | feat(10-04): add Imported badge to processing, financial, transport views; verify ESG exports include imported records |

## Known Stubs

None — all badge renders are wired to real `is_imported` boolean values from database queries. ESG and financial summaries confirmed to include imported records.

## Self-Check: PASSED

All 6 key files found. Both task commits (3ae4f33, 1d8b5a7) verified in git log.
