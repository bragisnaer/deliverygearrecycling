---
phase: 09
plan: 06
subsystem: notifications
tags: [notifications, email, dispatch-helper, in-app, facility-inactive, uninvoiced]
dependency_graph:
  requires: [09-01, 09-02, 09-03]
  provides: [notification-events-wired, dispatchNotification-helper, facility-inactive-check]
  affects: [prison-intake, pickup-management, transport-outbound, financial, dashboard]
tech_stack:
  added: []
  patterns:
    - dispatchNotification helper with mute-preference check
    - getRecoAdminEmails() raw db cross-tenant query
    - Non-blocking notification + email via try/catch at all trigger points
    - Dashboard page-load alert check pattern (matches checkAndCreateAgeingAlerts from Phase 4)
    - 7-day deduplication guard for facility_inactive alerts
key_files:
  created:
    - apps/web/lib/notification-events.ts
  modified:
    - apps/web/app/prison/actions.ts
    - apps/web/app/(ops)/pickups/actions.ts
    - apps/web/app/(ops)/transport/outbound/actions.ts
    - apps/web/app/(ops)/financial/actions.ts
    - apps/web/app/(ops)/dashboard/actions.ts
    - apps/web/app/(ops)/dashboard/page.tsx
decisions:
  - dispatchNotification uses raw db (not withRLSContext) — matches prison_role pattern from Phase 5 where role has no notifications INSERT policy
  - Defective batch match notification fires before quarantine_blocked early return — same invocation point as the block itself
  - checkFacilityInactiveAlerts deduplication uses 7-day window matching plan spec — avoids daily spam on persistent inactive facilities
  - prison_intake notification added to submitIntake (expected deliveries only) — unexpected_intake was already wired in Phase 5
  - processing_submitted notification added after successful submitProcessingReport return — before the return to ensure fire on success
  - checkUninvoicedAlerts uses delivery_date (not delivered_at) column — matches actual schema column on intake_records
  - pickup_confirmed notification + email added to confirmPickup — fetches client user by submitted_by for email address
  - pickup_collected notification fires in updatePickupStatus when newStatus === picked_up
  - outbound_dispatched fires in markOutboundInTransit (transit = dispatched from warehouse)
  - delivery_completed fires in markOutboundDelivered
  - pallets_received fires in updatePickupToAtWarehouse
metrics:
  duration_seconds: ~360
  completed_date: "2026-03-21"
  tasks_completed: 3
  files_modified: 6
  files_created: 1
---

# Phase 9 Plan 06: Notification Event Wiring Summary

Centralized notification dispatch helper created; all 14 PRD notification events now have trigger points with in-app and email dispatch via a single `dispatchNotification` utility that enforces mute preferences and non-blocking email sending.

## Tasks Completed

| Task | Name | Commit |
|------|------|--------|
| 1 | Create centralized notification dispatch helper | a24386b |
| 2 | Wire discrepancy/defective email, uninvoiced_delivery alert, pickup confirmation, warehouse ageing email | 47516e0 |
| 3 | Wire facility inactive check and all six missing in-app notification events | 4b2c433 |

## What Was Built

### Task 1 — `apps/web/lib/notification-events.ts`

New server-only utility module:
- `dispatchNotification(params)` — checks mute preferences for non-critical types, inserts in-app notification (raw db), sends email (non-blocking); critical types bypass muting entirely
- `getRecoAdminEmails()` — queries all reco-admin users via raw db (bypasses RLS for cross-tenant admin email lookup)

### Task 2 — Event Wiring

- **`prison/actions.ts`**: `defective_batch_match` dispatched before quarantine_blocked return; `DiscrepancyAlertEmail` sent after existing discrepancy notification insert
- **`(ops)/pickups/actions.ts`**: `pickup_confirmed` with `PickupConfirmedEmail` in `confirmPickup`; `pickup_collected` in `updatePickupStatus` when transitioning to `picked_up`
- **`(ops)/transport/outbound/actions.ts`**: `WarehouseAgeingAlertEmail` in `checkAndCreateAgeingAlerts`; `pallets_received` in `updatePickupToAtWarehouse`; `outbound_dispatched` in `markOutboundInTransit`; `delivery_completed` in `markOutboundDelivered`
- **`(ops)/financial/actions.ts`**: `checkUninvoicedAlerts()` function with `UninvoicedAlertEmail` dispatch via `dispatchNotification`

### Task 3 — Facility Inactive Check + Missing Events

- **`(ops)/dashboard/actions.ts`**: `checkFacilityInactiveAlerts()` iterates active facilities, checks intake recency, deduplicates via 7-day window, dispatches `facility_inactive` with `FacilityInactiveAlertEmail`
- **`(ops)/dashboard/page.tsx`**: Both `checkFacilityInactiveAlerts()` and `checkUninvoicedAlerts()` wired on page load for reco-admin only (non-blocking try/catch)
- **`prison/actions.ts`**: `prison_intake` notification in `submitIntake`; `processing_submitted` in `submitProcessingReport`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used `delivery_date` instead of `delivered_at` for uninvoiced threshold query**
- **Found during:** Task 2
- **Issue:** The plan referenced `delivered_at` but `intakeRecords` schema uses `delivery_date` column
- **Fix:** Used `delivery_date` column in `checkUninvoicedAlerts` threshold comparison
- **Files modified:** `apps/web/app/(ops)/financial/actions.ts`

**2. [Rule 1 - Bug] `min()` not exported from drizzle-orm**
- **Found during:** Task 2
- **Issue:** Plan template used `min()` Drizzle aggregate helper but it is not exported from `drizzle-orm` at the installed version (0.45.1)
- **Fix:** Replaced with `sql<Date | null>\`min(...)\`` template literal
- **Files modified:** `apps/web/app/(ops)/financial/actions.ts`

**3. [Rule 2 - Missing] `pickup_collected` and `pickup_confirmed` trigger points are in `(ops)/pickups/actions.ts`**
- **Found during:** Task 2
- **Issue:** Plan expected `(ops)/pickups/[id]/actions.ts` which does not exist; pickup status management is in `(ops)/pickups/actions.ts`
- **Fix:** Added both notifications to the existing `confirmPickup` and `updatePickupStatus` functions in `(ops)/pickups/actions.ts`
- **Files modified:** `apps/web/app/(ops)/pickups/actions.ts`

## Known Stubs

None. All notification calls use real entity IDs and titles derived from available context at trigger points. The discrepancy email uses `facilityId` (UUID) instead of facility name for the `facilityName` prop because the facility name is not available in `submitIntake` context — this is a display imperfection but does not prevent the notification from firing.

## Self-Check: PASSED

- FOUND: apps/web/lib/notification-events.ts
- FOUND: apps/web/app/(ops)/dashboard/actions.ts (with checkFacilityInactiveAlerts)
- FOUND commit a24386b: feat(09-06): create centralized dispatchNotification helper
- FOUND commit 47516e0: feat(09-06): wire notification events to trigger points
- FOUND commit 4b2c433: feat(09-06): wire facility inactive check and missing in-app notification events
