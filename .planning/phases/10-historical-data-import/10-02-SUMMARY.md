---
phase: 10-historical-data-import
plan: 02
subsystem: import
tags: [zod, validation, import, csv, xlsx, fk-resolution, column-mapping]

# Dependency graph
requires:
  - phase: 10-historical-data-import
    provides: Import infrastructure context (plan 01)
provides:
  - Zod schemas for all five import sources (pickupLogSchema, intakeLogSchema, greenloopSchema, invoiceBinderSchema, transportCostSchema)
  - validateRows helper with spreadsheet-convention row numbering (row 2 = first data row)
  - applyColumnMapping for spreadsheet header → platform field name transformation
  - resolveForeignKeys for string name → UUID FK resolution with error reporting
  - IMPORT_SOURCES registry with field metadata, target tables, hasLines configuration
affects: [import-wizard-ui, import-executor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-source Zod schema pattern: z.coerce for dates/numbers, z.enum for status fields, .default() for optional enums"
    - "validateRows wraps safeParse with spreadsheet row numbering (index + 2) for user-readable error messages"
    - "resolveForeignKeys deletes source string field and inserts UUID field in-place, reports errors for unresolvable names"
    - "applyColumnMapping drops all unmapped columns — only explicitly mapped headers survive into platform rows"

key-files:
  created:
    - apps/web/lib/import-sources.ts
    - apps/web/lib/import-validators.ts
    - apps/web/lib/import-validators.test.ts
  modified: []

key-decisions:
  - "pallet_count error path includes field name in Zod path[0] so validateRows field extraction works correctly — error message 'Pallet count must be positive' plus path ['pallet_count'] satisfies the test requirement"
  - "resolveForeignKeys row numbers are 1-indexed from 1 (first data row = 1), not 2 — different from validateRows which uses spreadsheet convention; FK resolution operates on already-mapped rows without headers"
  - "Pre-existing TypeScript errors in apps/web (intake/actions.ts, notification-actions.ts) are out of scope — no TS errors introduced by new files"

patterns-established:
  - "Import validators use zod .coerce for all date and number fields — handles both string CSV/XLSX values and native JS types"
  - "FKLookups type is a flat record of optional lookup maps; resolveForeignKeys detects which fields are present in the row before attempting lookup"

requirements-completed: [IMPORT-01, IMPORT-02]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 10 Plan 02: Import Validators and Source Registry Summary

**Five Zod schemas with FK resolution and column mapping for CSV/XLSX import of pickup logs, intake logs, GreenLoop reports, invoice binder, and transport costs**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T13:12:40Z
- **Completed:** 2026-03-21T13:15:28Z
- **Tasks:** 2 (plus TDD red/green commits)
- **Files modified:** 3

## Accomplishments
- Source definitions registry for all five historical import sources with field metadata, target tables, and line item configuration
- Five Zod schemas with coerce for dates/numbers and enum validation for status fields
- validateRows returns errors with spreadsheet row numbering (row 2 = first data row, matching header row convention)
- resolveForeignKeys replaces facility_name, product_name, location_name, intake_reference, pickup_reference, and provider_name with their UUID equivalents
- applyColumnMapping transforms arbitrary spreadsheet headers to platform field names, dropping all unmapped columns
- 19 unit tests covering all five schemas, validateRows row numbering, column mapping, and FK resolution error cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Import source definitions registry** - `ea90a07` (feat)
2. **Task 2: TDD RED — failing tests** - `556d88a` (test)
3. **Task 2: TDD GREEN — implementation** - `ed82562` (feat)

## Files Created/Modified
- `apps/web/lib/import-sources.ts` - IMPORT_SOURCES registry with ImportSourceId, ImportSource, ImportSourceField types and all five source definitions
- `apps/web/lib/import-validators.ts` - Five Zod schemas plus validateRows, applyColumnMapping, resolveForeignKeys, getSchemaForSource
- `apps/web/lib/import-validators.test.ts` - 19 unit tests covering all schemas and helpers

## Decisions Made
- `resolveForeignKeys` uses 1-indexed row numbers from 1 (not 2) because FK resolution operates on already-extracted data rows without a header row
- `validateRows` uses row 2 as first row (spreadsheet convention where row 1 = headers)
- Pre-existing TypeScript errors in `intake/actions.ts` and `notification-actions.ts` are out of scope — zero TS errors introduced by new files

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Import source registry and validators are ready for the import wizard UI (plan 03)
- FK resolution helpers are ready to receive lookup maps from DB queries in the executor
- All five schemas tested and passing; row numbering matches spreadsheet convention for user-readable error display

---
*Phase: 10-historical-data-import*
*Completed: 2026-03-21*
