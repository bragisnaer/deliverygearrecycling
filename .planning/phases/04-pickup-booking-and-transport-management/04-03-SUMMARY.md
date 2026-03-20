---
phase: 04-pickup-booking-and-transport-management
plan: "03"
subsystem: pickup-management-ui
tags:
  - pickups
  - server-actions
  - tdd
  - client-portal
  - ops-portal
  - status-management
dependency_graph:
  requires:
    - 04-01 (pickups schema, RLS policies, DB trigger for reference)
    - 04-02 (submitPickupRequest action, PickupBookingForm)
  provides:
    - ops pickup queue page with status filter tabs
    - ops pickup detail page with confirm/cancel actions
    - client pickup list page with New Pickup button
    - client pickup detail page with 24h cancel enforcement
    - cancelPickupAsClient server action (PICKUP-06)
    - confirmPickup server action
    - cancelPickup server action (ops)
    - updatePickupStatus server action
  affects:
    - 04-05 (transport booking links from ops detail page)
    - 04-06 (outbound shipment uses pickup status transitions)
tech_stack:
  added: []
  patterns:
    - TDD red-green with vi.resetModules() between describe blocks for isolation
    - withRLSContext for all DB reads/writes
    - @base-ui/react Dialog for ops cancel confirmation modal
    - Two-step confirmation inline (no modal) for client cancel
    - requireAuth(['reco-admin','reco']) for ops pages
    - requireAuth(['client','client-global']) for client pages
key_files:
  created:
    - apps/web/app/(ops)/pickups/page.tsx
    - apps/web/app/(ops)/pickups/[id]/page.tsx
    - apps/web/app/(ops)/pickups/[id]/confirm-pickup-button.tsx
    - apps/web/app/(ops)/pickups/[id]/cancel-pickup-dialog.tsx
    - apps/web/app/(ops)/pickups/actions.ts
    - apps/web/app/(ops)/pickups/actions.test.ts
    - apps/web/app/(client)/pickups/page.tsx
    - apps/web/app/(client)/pickups/[id]/page.tsx
    - apps/web/app/(client)/pickups/[id]/cancel-pickup-client-button.tsx
  modified:
    - apps/web/app/(client)/pickups/actions.ts (added cancelPickupAsClient)
    - apps/web/app/(client)/pickups/actions.test.ts (added cancelPickupAsClient tests)
    - apps/web/app/(ops)/ops-nav-bar.tsx (added Pickups, Transport links)
    - apps/web/app/(client)/layout.tsx (added nav bar with Overview and Pickups)
decisions:
  - Client cancel uses two-step inline confirmation (no modal) — simpler UX, avoids modal overhead for a destructive action on the client's own pickup
  - CancelPickupClientButton: confirmed_date 24h rule computed server-side in page.tsx (hides button) AND enforced server-side in cancelPickupAsClient (defence in depth)
  - Pre-existing TS error in submitPickupRequest test (capturedInsertValues typed as never) left as-is — out of scope, existed before plan 02
metrics:
  duration_minutes: 68
  completed_date: "2026-03-20T18:02:38Z"
  tasks_completed: 2
  files_created: 9
  files_modified: 4
---

# Phase 04 Plan 03: Pickup Management UI Summary

Pickup queue and detail pages for reco-admin and client portal, with TDD-tested Server Actions for status transitions, 24h client cancel rule, and nav bar updates.

## What Was Built

### Task 1: Ops Pickup Queue + Detail + Server Actions (TDD)

**Server Actions** (`apps/web/app/(ops)/pickups/actions.ts`):

- `confirmPickup(pickupId)`: validates status='submitted' before setting status='confirmed' + confirmed_date=now()
- `cancelPickup(pickupId, reason)`: validates non-empty reason + non-terminal status before cancelling
- `updatePickupStatus(pickupId, newStatus)`: validates allowed transitions via transition map
- `getPickupQueue(status?)`: fetches pickups with location join, optional status filter
- `getPickupDetail(pickupId)`: fetches full pickup with location + product lines

**Queue Page** (`apps/web/app/(ops)/pickups/page.tsx`): Status filter tabs (All, Submitted, Confirmed, Transport Booked, In Transit, Delivered), table with Reference/Location/Status/Pallets/Dates, rows link to detail page.

**Detail Page** (`apps/web/app/(ops)/pickups/[id]/page.tsx`): Full pickup info display with action buttons: Confirm Pickup (if submitted), Book Transport link (if confirmed, navigates to `/transport/new?pickup_id=...`), Cancel Pickup dialog (if non-terminal status).

**CancelPickupDialog**: @base-ui/react Dialog with reason textarea. Required by STATE.md decision (not Radix UI).

**Tests** (5 passing):
- confirmPickup status guard: blocks non-submitted pickups
- confirmPickup happy path: succeeds on submitted pickup
- cancelPickup reason required: blocks empty reason
- cancelPickup terminal status guard: blocks delivered/intake_registered/cancelled
- cancelPickup happy path: succeeds on confirmed pickup with reason

### Task 2: Client Pickup List + Detail + 24h Cancel Rule (TDD)

**cancelPickupAsClient** added to `apps/web/app/(client)/pickups/actions.ts`:
- Validates non-terminal status
- If confirmed_date exists and `confirmedAt - now() <= 24 * 60 * 60 * 1000`: returns error
- Otherwise cancels with reason='Cancelled by client'

**Client Pickup List** (`apps/web/app/(client)/pickups/page.tsx`): Filters by location_id for `client` role, shows all tenant pickups for `client-global`. New Pickup button links to `/pickups/new`.

**Client Pickup Detail** (`apps/web/app/(client)/pickups/[id]/page.tsx`):
- Fetches pickup + lines via withRLSContext (RLS enforces tenant scope)
- Cancel button only shown when `!isTerminal && canCancel`
- If within 24h of confirmed_date: shows informational warning message instead

**CancelPickupClientButton**: Two-step inline confirmation (click once → "Are you sure? / Keep / Yes, Cancel"). No modal — simpler for client self-service.

**OpsNavBar updated**: Added Pickups and Transport to NAV_ITEMS between Dashboard and Products.

**Client Layout updated**: Added nav bar with Overview and Pickups links in the header.

**Tests** (4 passing):
- 24h rule allow: confirmed_date 48h away → success
- 24h rule block: confirmed_date 12h away → error
- Unconfirmed cancel: status=submitted, no confirmed_date → success
- Terminal status: status=delivered → error

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript null safety on result.error**
- **Found during:** TypeScript check after implementation
- **Issue:** `setError(result.error)` — `result.error` typed as `string | undefined`, but `setError` expects `string | null`
- **Fix:** Changed to `setError(result.error ?? 'An error occurred')` in confirm-pickup-button.tsx, cancel-pickup-dialog.tsx, and cancel-pickup-client-button.tsx
- **Files modified:** 3 client component files
- **Commit:** ec071d3

### Out of Scope (Deferred)

Pre-existing TS error in `actions.test.ts` line 290: `capturedInsertValues?.estimated_weight_grams` typed as accessing property on `never`. This existed before plan 02 and is not related to this plan's changes. Logged to deferred-items.

## Known Stubs

None — all data is wired from the database via withRLSContext. The "Book Transport" link navigates to `/transport/new?pickup_id=...` which is a stub URL (transport booking built in plans 05/06), but this is intentional — the link is a placeholder until plan 05 delivers that page.

## Self-Check: PASSED

All files found:
- FOUND: apps/web/app/(client)/pickups/page.tsx
- FOUND: apps/web/app/(client)/pickups/[id]/page.tsx
- FOUND: apps/web/app/(client)/pickups/actions.ts
- FOUND: apps/web/app/(client)/pickups/actions.test.ts
- FOUND: apps/web/app/(ops)/pickups/page.tsx
- FOUND: apps/web/app/(ops)/pickups/[id]/page.tsx
- FOUND: apps/web/app/(ops)/pickups/actions.ts
- FOUND: apps/web/app/(ops)/pickups/actions.test.ts

All commits found:
- ec071d3 feat(04-03): client pickup list, detail page with 24h cancel rule, and nav updates
- 142dfc9 test(04-03): add failing tests for cancelPickupAsClient 24h cancel rule
- eccc5b8 feat(04-03): ops pickup queue page, detail page, and Server Actions with status guards
- f0edd7b test(04-03): add failing tests for confirmPickup and cancelPickup status guards
