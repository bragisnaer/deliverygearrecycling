---
phase: 05-prison-intake-and-counting
plan: "08"
subsystem: ops-intake-discrepancy-dashboard
tags: [discrepancy, analytics, dashboard, aggregate-sql, persistent-flag]
dependency_graph:
  requires: ["05-01", "05-04"]
  provides: [discrepancy-dashboard, getDiscrepancyStats, isPersistentProblemMarket-integration]
  affects: [ops-intake-queue]
tech_stack:
  added: []
  patterns:
    - "Raw SQL via Drizzle sql template tag for aggregate GROUP BY queries"
    - "Promise.all parallel data fetching in Server Components"
    - "Client component tabs with server-fetched data passed as props"
key_files:
  created:
    - apps/web/app/(ops)/intake/discrepancy/page.tsx
    - apps/web/app/(ops)/intake/discrepancy/components/discrepancy-tabs.tsx
  modified:
    - apps/web/app/(ops)/intake/actions.ts
decisions:
  - "Raw SQL via Drizzle sql`` tag used for all four aggregate queries — Drizzle query builder cannot express window functions and complex CASE aggregations as cleanly"
  - "countryTrends fetched with parallel Promise.all on page — market count is small (<20) so N parallel queries is acceptable; avoids a complex multi-dimensional GROUP BY in a single query"
  - "Trend direction computed client-side from monthly rate array (first half vs last half average) — avoids extra SQL computation"
  - "rows.rows ?? rows pattern used for Drizzle execute() result — handles both raw and Drizzle result shapes"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-20T20:26:17Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 05 Plan 08: Discrepancy Analytics Dashboard Summary

Discrepancy analytics dashboard with three-tab aggregate view (By Country, By Product, By Facility), rolling 6-month SQL aggregation, trend arrows, and persistent problem market auto-flagging via isPersistentProblemMarket.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create discrepancy dashboard Server Actions with aggregate queries | 5262068 | apps/web/app/(ops)/intake/actions.ts |
| 2 | Build discrepancy dashboard page with three tabs | 3bb182d | apps/web/app/(ops)/intake/discrepancy/page.tsx, apps/web/app/(ops)/intake/discrepancy/components/discrepancy-tabs.tsx |

## What Was Built

**Four Server Actions added to `apps/web/app/(ops)/intake/actions.ts`:**

- `getDiscrepancyByCountry()` — Single aggregate SQL over `intake_records` grouped by `origin_market`, rolling 6-month window
- `getDiscrepancyByProduct()` — Single aggregate SQL over `intake_lines JOIN products`, grouped by product name
- `getDiscrepancyByFacility()` — Single aggregate SQL over `intake_records JOIN prison_facilities`
- `getMonthlyDiscrepancyByCountry(country)` — Monthly rates for a country + `isPersistentProblemMarket()` flag computation

**Dashboard at `/(ops)/intake/discrepancy`:**

- `page.tsx` (Server Component): `requireRecoAdmin()` via action call, parallel `Promise.all` for three aggregate datasets, parallel country trend fetches
- `discrepancy-tabs.tsx` (Client Component): Three-tab view using shadcn `Tabs` / `Table` / `Badge`. Rates >15% shown in `text-amber-700`. Persistent markets show destructive `Badge`. Trend arrows use lucide `TrendingUp` / `TrendingDown`. Empty state per spec on each tab.

## Decisions Made

- Raw SQL via Drizzle `sql` template tag for all aggregate queries — CASE aggregations and NULLIF are cleaner in raw SQL than Drizzle builder expressions
- `Promise.all` parallel country trend fetch — market count small (<20), acceptable pattern; avoids complex multi-dimensional GROUP BY
- Trend direction computed client-side from monthly rates array (first half vs last half average delta)
- `rows.rows ?? rows` pattern for Drizzle `execute()` result to handle both result shapes

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: apps/web/app/(ops)/intake/discrepancy/page.tsx
- FOUND: apps/web/app/(ops)/intake/discrepancy/components/discrepancy-tabs.tsx
- FOUND: commit 5262068 (Task 1 — Server Actions)
- FOUND: commit 3bb182d (Task 2 — Dashboard page and tabs)
