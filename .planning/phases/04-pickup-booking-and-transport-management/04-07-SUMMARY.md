---
phase: 04-pickup-booking-and-transport-management
plan: 07
subsystem: transport
tags: [transport, outbound-shipment, pro-rata, cost-allocation, server-actions, vitest]

requires:
  - phase: 04-pickup-booking-and-transport-management/04-01
    provides: outboundShipments and outboundShipmentPickups schema tables
  - phase: 04-pickup-booking-and-transport-management/04-06
    provides: getWarehouseInventory action returning at_warehouse pickups

provides:
  - calculateProRataAllocation pure function with rounding correctness
  - createOutboundShipment server action — inserts outbound_shipments + outbound_shipment_pickups, cascades pickup status to in_outbound_shipment
  - markOutboundDelivered server action — cascades delivered status to all linked pickups
  - Outbound shipment creation page with checkbox pickup selection and editable pro-rata cost allocation UI

affects:
  - 04-08 (outbound shipment list/detail views will consume these actions)
  - prison intake phase (delivered pickups feed intake registration)

tech-stack:
  added: []
  patterns:
    - Pure export function for pro-rata allocation enables isolated unit testing without DB mocking
    - Client component (OutboundShipmentForm) holds all interactive state; server component (page.tsx) handles data fetching with auth() directly
    - pickup_allocations serialised as JSON in FormData for complex nested array submission to server action
    - Rounding remainder distributed to last pickup item (toFixed(4) accumulation)

key-files:
  created:
    - apps/web/app/(ops)/transport/outbound/actions.test.ts
    - apps/web/app/(ops)/transport/outbound/new/page.tsx
    - apps/web/app/(ops)/transport/outbound/new/outbound-shipment-form.tsx
  modified:
    - apps/web/app/(ops)/transport/outbound/actions.ts

key-decisions:
  - "calculateProRataAllocation exported as pure function — enables unit testing without DB mocking and reuse on client for live recalculation"
  - "pickup_allocations serialised as JSON string in FormData — avoids complex indexed FormData parsing for array of objects"
  - "page.tsx uses auth() directly (not requireAuth helper) — requireAuth returns AuthResult shape incompatible with JWTClaims required by withRLSContext"
  - "OutboundShipmentForm as separate client component file — page.tsx stays pure server component for data fetching"

patterns-established:
  - "Pure allocation function pattern: export pure function from 'use server' file for client-side reuse and isolated testing"
  - "JSON-in-FormData pattern: complex array data serialised as JSON string for server action submission"

requirements-completed:
  - TRANS-06
  - TRANS-07
  - TRANS-10

duration: 5min
completed: 2026-03-20
---

# Phase 04 Plan 07: Outbound Shipment Creation Summary

**Pro-rata cost allocation with rounding correction, outbound shipment creation and cascade delivery actions, and a checkbox-driven warehouse-to-prison shipment UI**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T19:26:20Z
- **Completed:** 2026-03-20T19:30:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- `calculateProRataAllocation` pure function distributes total cost by pallet count with rounding remainder assigned to last pickup, ensuring sum equals exactly totalCost to 4 decimal places
- `createOutboundShipment` validates allocation sum, inserts outbound_shipments + outbound_shipment_pickups rows, and cascades all selected pickup statuses to `in_outbound_shipment`
- `markOutboundDelivered` cascades `delivered` status to the shipment and all linked pickups in three atomic RLS-scoped operations
- TDD: 3 tests covering pro-rata default, pro-rata rounding correctness, and cascade delivery (all pass)
- Outbound creation page: checkbox pickup selection table, destination prison dropdown, total cost input, per-pickup editable allocation inputs, running total with mismatch indicator in red, soft warning at 7 pallets, Reset to Pro-rata button, submit disabled on mismatch

## Task Commits

1. **Task 1: Server actions + TDD tests** - `c9ce474` (feat)
2. **Task 2: Outbound shipment creation page** - `3748e7e` (feat)

**Plan metadata:** *(to be committed with SUMMARY)*

## Files Created/Modified

- `apps/web/app/(ops)/transport/outbound/actions.ts` — Added `calculateProRataAllocation`, `outboundShipmentSchema`, `createOutboundShipment`, `markOutboundDelivered`; added imports for `outboundShipments`, `outboundShipmentPickups`, `z`
- `apps/web/app/(ops)/transport/outbound/actions.test.ts` — Created: 3 TDD tests for pro-rata default, rounding, and cascade delivery
- `apps/web/app/(ops)/transport/outbound/new/page.tsx` — Created: Server component fetching held pickups, prison facilities, transport providers; renders OutboundShipmentForm
- `apps/web/app/(ops)/transport/outbound/new/outbound-shipment-form.tsx` — Created: Client component with full interactive checkbox/allocation state, pro-rata recalculation, 7-pallet warning, allocation mismatch validation

## Decisions Made

- `calculateProRataAllocation` exported as pure function from the `'use server'` file — allows the client component to import and call it for live pro-rata recalculation without a network roundtrip, and enables isolated unit testing without any DB mocking
- `pickup_allocations` serialised as a JSON string inside FormData — the array of `{pickup_id, pallet_count, allocated_cost_eur}` objects is too complex for indexed FormData encoding; JSON string is simpler and unambiguous
- `page.tsx` calls `auth()` directly rather than `requireAuth()` — `requireAuth` returns an `AuthResult` shape (with a nested `user` property) that is incompatible with the `JWTClaims` interface expected by `withRLSContext`; using `auth()` directly is consistent with the actions.ts pattern

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- TypeScript error in initial `page.tsx` draft: `requireAuth` return type `AuthResult` has a nested `user` property, making `user.id` inaccessible at top level and `AuthResult` incompatible with `JWTClaims`. Fixed by using `auth()` directly, consistent with existing server action auth pattern. Rule 1 (bug fix), no separate commit needed.

## Known Stubs

None — all data is wired from real DB queries via `getWarehouseInventory()` and direct Drizzle selects for prison facilities and transport providers.

## Next Phase Readiness

- Outbound shipment creation fully functional; ready for plan 08 (outbound shipment list and detail views)
- `markOutboundDelivered` action available for delivery confirmation UI in plan 08
- Prison intake phase can consume `delivered` pickup status downstream

---
*Phase: 04-pickup-booking-and-transport-management*
*Completed: 2026-03-20*

## Self-Check: PASSED

- FOUND: apps/web/app/(ops)/transport/outbound/actions.ts
- FOUND: apps/web/app/(ops)/transport/outbound/actions.test.ts
- FOUND: apps/web/app/(ops)/transport/outbound/new/page.tsx
- FOUND: apps/web/app/(ops)/transport/outbound/new/outbound-shipment-form.tsx
- FOUND commit: c9ce474 (feat: server actions + TDD tests)
- FOUND commit: 3748e7e (feat: outbound shipment creation page)
