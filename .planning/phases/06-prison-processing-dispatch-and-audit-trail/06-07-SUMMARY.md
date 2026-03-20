---
phase: 06-prison-processing-dispatch-and-audit-trail
plan: "07"
subsystem: dispatch-schema-and-actions
tags:
  - drizzle
  - rls
  - server-actions
  - tdd
  - dispatch
dependency_graph:
  requires:
    - 06-04 (processing.ts — sizeBucketEnum)
    - 05-01 (intakeRecords for FK reference)
    - 01-01 (auth roles, withRLSContext pattern)
  provides:
    - outbound_dispatches table with RLS
    - outbound_dispatch_lines table with RLS
    - dispatchStatusEnum
    - createDispatch, updateDispatchStatus, getDispatches Server Actions
  affects:
    - 06-08 (prison dispatch view will query these tables)
    - Phase 7 (financial linking via dispatch records)
tech_stack:
  added: []
  patterns:
    - Drizzle pgTable + pgPolicy RLS deny-all restrictive base
    - withRLSContext transaction wrapping for all DB writes
    - VALID_TRANSITIONS record for testable lifecycle enforcement
    - TDD red-green cycle for Server Actions
key_files:
  created:
    - packages/db/src/schema/dispatch.ts
    - apps/web/app/(ops)/dispatch/actions.ts
    - apps/web/app/(ops)/dispatch/actions.test.ts
  modified:
    - packages/db/src/schema/index.ts
decisions:
  - "VALID_TRANSITIONS exported as const — enables isolated unit testing without DB mocking"
  - "intake_record_id nullable FK on outbound_dispatches — null = facility-level fallback, set = deterministic traceability chain"
  - "Prison role gets SELECT only on outbound_dispatches (no INSERT/UPDATE) per DISPATCH-04"
  - "outboundDispatchLines prison SELECT via EXISTS subquery on parent — same pattern as intake_lines and processing_report_lines"
  - "sizeBucketEnum imported from processing.ts (not redefined) — processing.ts exists in Wave 1"
metrics:
  duration_seconds: 244
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 4
---

# Phase 06 Plan 07: Outbound Dispatch Schema and Server Actions Summary

**One-liner:** Drizzle dispatch schema with RLS (reco-admin CRUD, prison SELECT only) and Server Actions enforcing created→picked_up→delivered lifecycle with optional intake_record_id for deterministic traceability.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Outbound dispatch Drizzle schema with RLS and intake_record_id FK | f94dbb3 | packages/db/src/schema/dispatch.ts, packages/db/src/schema/index.ts |
| 2 (RED) | Failing tests for dispatch actions | cf8901b | apps/web/app/(ops)/dispatch/actions.test.ts |
| 2 (GREEN) | Dispatch Server Actions with lifecycle enforcement | cc27a6c | apps/web/app/(ops)/dispatch/actions.ts |

## What Was Built

### Schema (Task 1)

`packages/db/src/schema/dispatch.ts` provides:

- `dispatchStatusEnum` — `['created', 'picked_up', 'delivered']`
- `outboundDispatches` table with full column set including `intake_record_id` nullable FK to `intakeRecords.id`, `voided`/`void_reason` columns, and `dispatch_date`, `destination`, `carrier`
- `outboundDispatchLines` table with `product_id`, `sizeBucketEnum`, `sku_code`, `quantity`, cascade delete from parent
- RLS: deny-all restrictive base + prison SELECT only (DISPATCH-04) + reco SELECT + reco-admin full CRUD on both tables
- Prison SELECT on lines via EXISTS subquery on parent dispatch (same pattern as intake_lines)

### Server Actions (Task 2 — TDD)

`apps/web/app/(ops)/dispatch/actions.ts` exports:

- `VALID_TRANSITIONS` — exported record for testable lifecycle validation
- `createDispatch(input)` — reco-admin only; inserts dispatch + lines in single `withRLSContext` call; accepts optional `intake_record_id`
- `updateDispatchStatus(id, newStatus)` — fetches current status, validates against `VALID_TRANSITIONS`, returns `{ error: 'invalid_transition' }` for disallowed moves
- `getDispatches(facilityId?)` — returns non-voided records; optional facility filter

## Test Results

11 tests passing, 0 failing:
- VALID_TRANSITIONS lifecycle ordering (4 tests)
- createDispatch: role rejection, optional intake_record_id, no intake_record_id (3 tests)
- updateDispatchStatus: valid transition, created→delivered skip, delivered→created backwards (3 tests)
- getDispatches: non-voided filter (1 test)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all exports wired to real schema and real DB pattern. No placeholder data flows to UI (no UI created in this plan — that is Plan 08).

## Self-Check: PASSED
