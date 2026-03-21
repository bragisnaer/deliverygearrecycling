---
phase: 08-dashboards-and-esg-metrics
plan: 02
subsystem: esg-page
tags: [esg, dashboard, server-actions, temporal-join, raw-sql, drizzle, shadcn]

# Dependency graph
requires:
  - 08-01 (esg-calculator pure functions: sumMaterialWeights, calculateReuseRate, calculateCO2Avoided)
provides:
  - ESG metrics page at /esg with material breakdown, reuse rate, CO2 stub
  - Server actions: getEsgData, getProcessingStreamCounts, getEsgTenants
  - Inline methodology display via MethodologyBlock
  - ESG nav link in OpsNavBar
affects:
  - apps/web/app/(ops)/ops-nav-bar.tsx (ESG link added after Financial)

# Tech stack
added: []
patterns:
  - Temporal composition join: product_materials.effective_from/effective_to vs ir.delivery_date
  - Raw db (no RLS) for cross-tenant reco-admin queries — established dashboard pattern
  - Promise.all parallel fetch in Server Component page
  - Native <form method="GET"> for tenant filter (no client JS needed)
  - <details>/<summary> for collapsible methodology block

# Key files
created:
  - apps/web/app/(ops)/esg/actions.ts
  - apps/web/app/(ops)/esg/page.tsx
  - apps/web/app/(ops)/esg/components/esg-summary-card.tsx
  - apps/web/app/(ops)/esg/components/material-breakdown-table.tsx
  - apps/web/app/(ops)/esg/components/methodology-block.tsx
modified:
  - apps/web/app/(ops)/ops-nav-bar.tsx

# Decisions
key-decisions:
  - "getEsgData passes reuseRate: 0 in returned EsgData — reuseRate is calculated in page.tsx from getProcessingStreamCounts result using calculateReuseRate; kept separate to match plan interface"
  - "CO2 avoided renders pending=true from calculateCO2Avoided stub returning formula_pending: true — matches ESG-04 blocker acknowledgement"
  - "Temporal join filters: pm.effective_from <= ir.delivery_date AND (pm.effective_to IS NULL OR pm.effective_to > ir.delivery_date) — open-ended materials use effective_to IS NULL"

# Metrics
duration_minutes: 15
completed_date: "2026-03-21"
tasks_completed: 2
files_changed: 6
---

# Phase 8 Plan 2: ESG Metrics Page Summary

**One-liner:** ESG metrics page with temporal composition join for material weights, reuse rate card, CO2 avoided stub, and inline methodology display accessible from ops nav.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ESG server actions with temporal composition join | 0f59544 | apps/web/app/(ops)/esg/actions.ts |
| 2 | ESG metrics page with components and nav link | c894b4e | esg/page.tsx, 3 components, ops-nav-bar.tsx |

## What Was Built

**`actions.ts`** — Three server actions under `'use server'`:
- `getEsgData(tenantFilter?, dateFrom?, dateTo?)`: Temporal composition join across intake_lines → intake_records → product_materials (effective_from/to) → material_library. Passes results to `sumMaterialWeights()` and `calculateCO2Avoided()`. Excludes `ir.voided = false`.
- `getProcessingStreamCounts(tenantFilter?)`: Aggregates reuse vs total quantities from processing_report_lines via FILTER WHERE clause. Excludes voided processing reports.
- `getEsgTenants()`: All active tenants for filter dropdown.

**`page.tsx`** — Server Component with `force-dynamic`:
- Parallel `Promise.all([getEsgData, getProcessingStreamCounts, getEsgTenants])`
- Native GET form for tenant filter
- 3 stat cards: Total Items Processed, Total Material Weight, Reuse Rate
- CO2 Avoided card with `pending={true}` (formula_pending stub)
- MaterialBreakdownTable + MethodologyBlock
- Export links (routes created in Plan 03)

**Components** — All Server Components:
- `EsgSummaryCard`: title/value/subtitle/pending props; italic "Pending" text when pending=true
- `MaterialBreakdownTable`: shadcn Table with right-aligned numeric columns; empty state message
- `MethodologyBlock`: `<details>/<summary>` with formula in `font-mono` and labelled input list

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

- Pre-existing TypeScript errors in `app/(ops)/esg/export/route.ts` (created by a parallel plan in wave 2) are out of scope for this plan.
- Pre-existing errors in `app/(ops)/intake/actions.ts` and test files also out of scope.

## Known Stubs

- `esgData.reuseRate` field in `EsgData` return type is always 0 — reuseRate is correctly recalculated in `page.tsx` from `streamCounts` via `calculateReuseRate()`. This is not a UI stub; it is an intentional separation of concerns.
- CO2 Avoided renders "Pending" — intentional stub per ESG-04 blocker. Will be wired when reco/Wolt agree on per-material CO2 factors.

## Self-Check: PASSED

Files verified to exist:
- apps/web/app/(ops)/esg/actions.ts — FOUND
- apps/web/app/(ops)/esg/page.tsx — FOUND
- apps/web/app/(ops)/esg/components/esg-summary-card.tsx — FOUND
- apps/web/app/(ops)/esg/components/material-breakdown-table.tsx — FOUND
- apps/web/app/(ops)/esg/components/methodology-block.tsx — FOUND

Commits verified:
- 0f59544 feat(08-02): ESG server actions with temporal composition join
- c894b4e feat(08-02): ESG metrics page with components and nav link

Tests: 15/15 passed (esg-calculator — no regressions)
