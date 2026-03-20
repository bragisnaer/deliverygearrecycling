---
phase: 06-prison-processing-dispatch-and-audit-trail
plan: "09"
subsystem: traceability
tags: [traceability, dispatch, intake, processing, audit-trail]
dependency_graph:
  requires: ["06-05", "06-07", "06-02"]
  provides: ["traceability-chain", "intake-detail-page"]
  affects: ["intake-queue", "dispatch-view", "processing-pipeline"]
tech_stack:
  added: []
  patterns:
    - "assembleTraceabilityChain pure function — no DB coupling, tested in isolation"
    - "dispatch dual-lookup: deterministic via intake_record_id FK, fallback via prison_facility_id+tenant_id"
    - "VoidDispatchButton pattern — thin client component for dialog state in Server Component page"
key_files:
  created:
    - apps/web/lib/traceability.ts
    - apps/web/lib/traceability.test.ts
    - apps/web/app/(ops)/intake/components/traceability-chain.tsx
    - apps/web/app/(ops)/intake/components/intake-void-button.tsx
    - apps/web/app/(ops)/intake/[id]/page.tsx
  modified:
    - apps/web/app/(ops)/intake/actions.ts
    - apps/web/messages/da.json
decisions:
  - "assembleTraceabilityChain is a pure function — DB queries are in getTraceabilityChain (actions.ts); function is independently testable without DB mocking"
  - "dispatchFallback filtered to isNull(intake_record_id) dispatches only — dispatches linked to other specific intakes are excluded from facility fallback"
  - "IntakeVoidButton extracted as client component — page.tsx stays pure Server Component per VoidDispatchButton pattern from 06-08"
  - "getTraceabilityChain uses raw db (not withRLSContext) for all queries — cross-table reads; prison_role may lack policies on transport/pickup tables"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 7
---

# Phase 06 Plan 09: Traceability Chain Summary

Full traceability chain (pickup -> transport -> intake -> wash -> pack -> dispatch) with deterministic dispatch lookup via intake_record_id FK and facility-level fallback — rendered on intake detail page with responsive layout.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | assembleTraceabilityChain function with tests | 3c8fd91 | traceability.ts, traceability.test.ts, actions.ts |
| 2 | TraceabilityChainView component and intake detail page | 6539729 | traceability-chain.tsx, [id]/page.tsx, intake-void-button.tsx, da.json |

## What Was Built

### traceability.ts

`TraceabilityChain` interface with two dispatch fields:

- `dispatch: DispatchLink | null` — deterministic single dispatch found via `intake_record_id` FK
- `dispatchFallback: DispatchLink[] | null` — non-deterministic facility-level list when `dispatch` is null

`assembleTraceabilityChain(data)` pure function:
- Selects `directDispatch` first; when set, `dispatchFallback = null` always
- Falls back to `facilityDispatches` array when `directDispatch` is null
- Returns both null when no dispatches exist
- Handles `null` pickup gracefully for unexpected deliveries
- Uses `washReports[0] ?? null` and `packReports[0] ?? null` for voided-filtered reports

### traceability.test.ts

8 tests covering all 7 specified behavior cases:
- Full chain with deterministic dispatch
- Null pickup (unexpected delivery)
- Empty wash/pack arrays
- No dispatch at all (both null)
- Deterministic dispatch takes precedence even when facilityDispatches present
- Fallback dispatch array returned when directDispatch null
- Empty fallback returns null (not empty array)
- First wash report used when multiple present

### getTraceabilityChain (actions.ts)

Server action implementing the 6-step query chain:
1. Intake record fetch
2. Pickup + transport booking (conditional on pickup_id)
3. Wash reports filtered by `activity_type='wash', voided=false`
4. Pack reports filtered by `activity_type='pack', voided=false`
5. Deterministic dispatch: `WHERE intake_record_id = id AND voided = false`
6. Facility fallback: `WHERE prison_facility_id = ... AND tenant_id = ... AND voided = false AND intake_record_id IS NULL`

Uses raw `db` (no `withRLSContext`) — cross-table reads including transport/pickup tables where prison_role may lack RLS policies.

### TraceabilityChainView component

Renders 6 stage cards connected by arrows:
- Desktop (md+): horizontal flex flow with ArrowRight connectors
- Mobile: vertical stack with ArrowDown connectors
- Null stages: dashed border, italic "Ikke tilgængelig" text
- Deterministic dispatch: single card with "Direkte kobling" badge
- Fallback dispatch: "Mulige forsendelser (N)" badge + sub-cards for each dispatch

### intake [id]/page.tsx

Server Component page:
- Calls `getTraceabilityChain(id)` → notFound() on missing record
- Calls `getEditHistory` → derives `isEdited` for `EditedIndicator`
- Renders `TraceabilityChainView` with chain data
- Renders `IntakeVoidButton` for reco-admin role only (thin client wrapper)

### da.json

Added `traceability` namespace with 11 keys including `possible_dispatches` and `direct_link`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — `getTraceabilityChain` fetches real data from all pipeline tables; `TraceabilityChainView` renders real chain data. No hardcoded placeholders flow to the UI.

## Self-Check: PASSED

- apps/web/lib/traceability.ts: FOUND
- apps/web/lib/traceability.test.ts: FOUND
- apps/web/app/(ops)/intake/components/traceability-chain.tsx: FOUND
- apps/web/app/(ops)/intake/[id]/page.tsx: FOUND
- commit 3c8fd91 (Task 1): FOUND
- commit 6539729 (Task 2): FOUND
