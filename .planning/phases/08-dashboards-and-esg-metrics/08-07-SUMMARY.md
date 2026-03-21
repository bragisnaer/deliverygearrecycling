---
phase: 08-dashboards-and-esg-metrics
plan: "07"
subsystem: database
tags: [postgres, indexes, performance, esg, drizzle, migration]

requires:
  - phase: 08-01
    provides: ESG server actions that drive the query patterns these indexes support
  - phase: 08-04
    provides: Dashboard aggregate queries on intake_records and pickups
  - phase: 08-05
    provides: Client dashboard queries on intake_records by delivery_date and pickups by location
  - phase: 08-06
    provides: Financial page queries on financial_records by invoice_status

provides:
  - Composite indexes for ESG temporal composition join (tenant+delivery_date, product+effective_from+effective_to)
  - Partial indexes on intake_records with WHERE voided=false to reduce scan scope
  - Dashboard aggregate indexes for pickup status, financial invoice status, and pipeline view
  - Client-scoped indexes for location-based and date-based filtering

affects: [performance-testing, deployment, 09-notifications, 10-historical-data-import]

tech-stack:
  added: []
  patterns:
    - "IF NOT EXISTS on all index creation — safe to run against DB where some indexes may already exist from prior migrations"
    - "Partial indexes with WHERE voided=false — reduces index size and scan scope for active-record queries"
    - "Manual SQL migration registered in drizzle journal — Phase 8 pattern for non-schema DDL"

key-files:
  created:
    - packages/db/migrations/0007_esg_dashboard_indexes.sql
  modified:
    - packages/db/migrations/meta/_journal.json

key-decisions:
  - "financial_records_invoice_status_idx uses IF NOT EXISTS — this index already created in 0006_financial_records.sql; double-creation is safe and idempotent"
  - "intake_records_prison_facility_id_idx not re-created — already exists from Phase 5 schema Drizzle-managed index; comment documents the skip"
  - "Sequential journal idx 5 assigned to tag 0007_esg_dashboard_indexes — manual migrations 0005 and 0006 were not registered in journal; idx follows last registered entry"

patterns-established:
  - "Composite index for temporal range join: (product_id, effective_from, effective_to) enables efficient date-window scans without full table scan"
  - "Partial composite index with tenant filter: (tenant_id, delivery_date) WHERE voided=false — combines RLS column + time range in one index"

requirements-completed: [DASH-06, ESG-05]

duration: 5min
completed: 2026-03-21
---

# Phase 8 Plan 07: ESG Dashboard Composite Indexes Summary

**Eight composite and partial SQL indexes covering ESG temporal joins, dashboard aggregates, and client-scoped queries — addressing DASH-06 performance requirement at index level**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-21T10:00:00Z
- **Completed:** 2026-03-21T10:05:00Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `0007_esg_dashboard_indexes.sql` with 8 `CREATE INDEX IF NOT EXISTS` statements covering all Phase 8 query hot paths
- Added partial indexes with `WHERE voided = false` on intake_records to reduce scan scope for active-record ESG and client queries
- Registered migration in drizzle `_journal.json` at idx 5 with tag `0007_esg_dashboard_indexes`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create composite index migration for ESG and dashboard queries** - `6d6cce7` (feat)

**Plan metadata:** _(pending final metadata commit)_

## Files Created/Modified

- `packages/db/migrations/0007_esg_dashboard_indexes.sql` - SQL migration with 8 composite/partial indexes for ESG temporal joins and dashboard aggregates
- `packages/db/migrations/meta/_journal.json` - Added journal entry idx 5 for 0007_esg_dashboard_indexes tag

## Decisions Made

- `financial_records_invoice_status_idx` uses `IF NOT EXISTS` — this index was already created in `0006_financial_records.sql`; idempotent re-declaration is safe and documents intent
- `intake_records_prison_facility_id_idx` not re-created — it already exists from Phase 5 Drizzle-managed schema index; a comment in the SQL documents the skip
- Journal entry assigned idx 5 (sequential after last registered idx 4) — manual migrations 0005 and 0006 were never registered in the journal; the new entry follows the last registered entry rather than matching the filename prefix

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Indexes will be applied when migration is run against the database.

## Next Phase Readiness

- All Phase 8 query hot paths have supporting indexes
- ESG temporal composition join (intake_records + product_materials effective date window) is indexed
- Dashboard aggregate queries (pickup status, financial invoice status) are indexed
- Client dashboard scoping (location_id, delivery_date) is indexed
- Ready for Phase 9 notifications and Phase 10 historical data import

---
*Phase: 08-dashboards-and-esg-metrics*
*Completed: 2026-03-21*
