---
phase: 08-dashboards-and-esg-metrics
plan: "05"
subsystem: client-dashboard
tags: [dashboard, client, esg, rls, role-branching]
dependency_graph:
  requires: [08-01, 08-02]
  provides: [client-dashboard-DASH-03, client-dashboard-DASH-04]
  affects: [apps/web/app/(client)/overview]
tech_stack:
  added: []
  patterns: [withRLSContext, Promise.all parallel fetch, raw SQL via drizzle sql template, as unknown as type cast, temporal composition join]
key_files:
  created:
    - apps/web/app/(client)/overview/actions.ts
    - apps/web/app/(client)/overview/components/pickup-activity-card.tsx
    - apps/web/app/(client)/overview/components/discrepancy-flag.tsx
    - apps/web/app/(client)/overview/components/volume-by-quarter-table.tsx
    - apps/web/app/(client)/overview/components/esg-summary-widget.tsx
  modified:
    - apps/web/app/(client)/overview/page.tsx
decisions:
  - "Raw SQL via drizzle sql template with (await tx.execute(sql`...`)) as unknown as T[] pattern — matches ops/intake/actions.ts pattern (rows.rows variant fails TypeScript since RowList is directly array-like)"
  - "esg-calculator.ts was already created in plan 08-01 — write attempt was a no-op; imports aligned correctly"
  - "client-global drill-down uses searchParams.location to filter to a single market — isGlobal AND !searchParams.location determines true cross-market aggregation mode"
  - "VolumeByQuarterTable renders subtotal rows per quarter for client-global view using Map grouping in the component"
metrics:
  duration_seconds: 435
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 6
---

# Phase 8 Plan 05: Client Dashboard Summary

**One-liner:** Role-aware client dashboard with pickup activity, sent-vs-received discrepancy flags, quarterly volume, and ESG summary — scoped by RLS with client-global cross-market drill-down via searchParams.

## Objective Achieved

Replaced the client dashboard stub (`apps/web/app/(client)/overview/page.tsx`) with a fully functional role-aware dashboard:

- **client role:** All queries scoped to `location_id` from JWT; single-location view
- **client-global role:** Queries span all tenant locations; market drill-down pill badges allow filtering to a single location via `?location=<uuid>` searchParam

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Client dashboard server actions with RLS-scoped queries | cbfad65 | actions.ts (created) |
| 2 | Client dashboard page with role-aware layout and components | a1ba6e1 | page.tsx, 4 component files |

## Architecture

**Data flow:**
```
page.tsx
  → auth() → session.user.role / location_id
  → Promise.all([
      getClientPickupActivity(claims, locationId),
      getClientSentVsReceived(claims, locationId),
      getClientVolumeByQuarter(claims, locationId),
      getClientEsgSummary(claims, locationId),
    ])
  → withRLSContext(claims, tx => tx.execute(sql`...`))
```

**ESG temporal join pattern** (from 08-RESEARCH Pattern 1):
```sql
JOIN product_materials pm ON pm.product_id = il.product_id
  AND pm.effective_from <= ir.delivery_date
  AND (pm.effective_to IS NULL OR pm.effective_to > ir.delivery_date)
JOIN material_library ml ON ml.id = pm.material_library_id
```

**Discrepancy colouring:**
- `>15%` — red + bold (`text-red-600 font-bold`)
- `5–15%` — amber (`text-amber-600 font-medium`)
- `<5%` — green (`text-green-600`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] esg-calculator.ts was missing from disk**
- **Found during:** Task 1 setup — actions.ts imports `sumMaterialWeights` from `@/lib/esg-calculator`
- **Issue:** File not yet created (plan 08-01 creates it but was parallel to this plan)
- **Fix:** Wrote esg-calculator.ts with sumMaterialWeights, calculateReuseRate, calculateCO2Avoided stub, serializeEsgCsv — identical spec to what 08-01 later committed
- **Files modified:** apps/web/lib/esg-calculator.ts
- **Commit:** cbfad65 (file was actually committed by 08-01 as `1f15ab2`; write was a no-op, file already existed on disk from prior agent)
- **Outcome:** No conflict; imports resolved correctly

**2. [Rule 1 - Bug] `.rows` property on Drizzle RowList causes TypeScript error**
- **Found during:** Task 1 first TypeScript check
- **Issue:** `(await tx.execute(sql`...`)).rows` — `RowList` from postgres.js driver is directly array-like; no `.rows` property in TypeScript types even though runtime `rows.rows ?? rows` pattern exists in older files
- **Fix:** Used `(await tx.execute(sql`...`)) as unknown as T[]` cast — matches ops dashboard `actions.ts` pattern exactly
- **Files modified:** apps/web/app/(client)/overview/actions.ts (rewritten)
- **Commit:** cbfad65

## Verification

- TypeScript: 0 errors across entire apps/web project
- Tests: 117 passed, 0 failures, 11 todo (no regressions)

## Known Stubs

None — all 4 data sections are wired to real DB queries through `withRLSContext`.

The `calculateCO2Avoided` function in `esg-calculator.ts` is a known stub (`formula_pending: true`) per STATE.md blocker — not exposed in this plan's UI (ESG summary widget shows material weight + reuse rate only, which are fully computed).

## Self-Check: PASSED

Files created:
- apps/web/app/(client)/overview/actions.ts — FOUND
- apps/web/app/(client)/overview/page.tsx — FOUND (modified)
- apps/web/app/(client)/overview/components/pickup-activity-card.tsx — FOUND
- apps/web/app/(client)/overview/components/discrepancy-flag.tsx — FOUND
- apps/web/app/(client)/overview/components/volume-by-quarter-table.tsx — FOUND
- apps/web/app/(client)/overview/components/esg-summary-widget.tsx — FOUND

Commits:
- cbfad65 feat(08-05): client dashboard server actions with RLS-scoped queries — FOUND
- a1ba6e1 feat(08-05): client dashboard page with role-aware layout and components — FOUND
