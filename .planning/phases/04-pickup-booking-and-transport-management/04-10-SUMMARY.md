---
phase: 04-pickup-booking-and-transport-management
plan: "10"
subsystem: integration
tags: [pickup-detail, transport-summary, status-timeline, outbound-shipments, delivery-cascade]
dependency_graph:
  requires: ["04-05", "04-06", "04-07", "04-08", "04-09"]
  provides: ["pickup-transport-summary-ui", "status-timeline", "outbound-shipment-list", "mark-in-transit", "mark-delivered-cascade"]
  affects:
    - apps/web/app/(ops)/pickups/[id]/page.tsx
    - apps/web/app/(ops)/pickups/actions.ts
    - apps/web/app/(ops)/transport/outbound/page.tsx
    - apps/web/app/(ops)/transport/outbound/actions.ts
tech_stack:
  added: []
  patterns: ["inline Server Actions for status buttons", "cross-module server action import", "Promise.all for parallel data fetching", "details/summary collapsible section"]
key_files:
  created: []
  modified:
    - apps/web/app/(ops)/pickups/[id]/page.tsx
    - apps/web/app/(ops)/pickups/actions.ts
    - apps/web/app/(ops)/transport/outbound/page.tsx
    - apps/web/app/(ops)/transport/outbound/actions.ts
decisions:
  - "markOutboundInTransit added to outbound/actions.ts — plan required Mark In Transit button on outbound page but no action existed; added as Rule 3 (blocking issue fix) with cascade to linked pickups matching markOutboundDelivered pattern"
  - "Status timeline uses direct vs. consolidation step arrays — consolidation shows at_warehouse/in_outbound_shipment steps; direct omits them"
  - "Inline Server Actions used for all status update buttons on pickup detail page — consistent with Phase 04 pattern established in Plans 05-07"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-20T19:44:00Z"
  tasks: 2
  files: 4
---

# Phase 04 Plan 10: Integration — Pickup Detail and Outbound Page Summary

Connected all Phase 4 components: pickup detail page shows transport booking summary (provider, type badge, leg 1/2 costs, proof of delivery), a horizontal status timeline with direct/consolidation variants, and context-sensitive action buttons including cross-module warehouse arrival; outbound page adds active/completed shipment tables with Mark In Transit and Mark Delivered cascade actions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Enhance pickup detail with transport booking summary and full status display | 0394aa8 | pickups/[id]/page.tsx, pickups/actions.ts |
| 2 | Add shipment list with delivery action to outbound page and run full test suite | e081a3d | transport/outbound/page.tsx, transport/outbound/actions.ts |

## What Was Built

### apps/web/app/(ops)/pickups/actions.ts
`getPickupDetail` extended to fetch:
- `transport_bookings` joined with `transport_providers` (provider name, warehouse address) and `prison_facilities` (name, address) via left join
- `outbound_shipment_pickups` joined with `outbound_shipments` to get allocated leg 2 cost and shipment status — only fetched when a booking exists

### apps/web/app/(ops)/pickups/[id]/page.tsx
Three new sections:

1. **Status timeline** — horizontal step indicator. Two variants: `DIRECT_STEPS` (6 steps) and `CONSOLIDATION_STEPS` (8 steps, includes `at_warehouse` and `in_outbound_shipment`). Steps past the current status show green with a checkmark; current step shows filled foreground; future steps show muted. Transport type determined from `pickup.booking?.transport_type`.

2. **Transport Booking section** — shown only when booking exists. Shows: transport type badge (direct=purple, consolidation=teal), provider name, confirmed pickup date, destination prison (direct) or warehouse address (consolidation), leg 1 cost, leg 2 allocated cost (if in outbound shipment), delivery notes, and proof of delivery link.

3. **Refined action buttons**: Confirm (submitted), Book Transport link (confirmed), Mark Picked Up (transport_booked), Mark In Transit (picked_up + direct), Mark Arrived at Warehouse (picked_up + consolidation — cross-module import of `updatePickupToAtWarehouse`), Mark Delivered (in_transit + direct), Cancel (non-terminal).

### apps/web/app/(ops)/transport/outbound/actions.ts
- `markOutboundInTransit(shipmentId)` — sets `outbound_shipments.status='in_transit'` and `dispatched_at`, then cascades `pickups.status='in_transit'` to all linked pickups
- `getOutboundShipments()` — returns `{ activeShipments, completedShipments }`: active fetches status IN ('created', 'in_transit'); completed fetches status='delivered' AND `delivered_at >= now - 30 days`; both joined with providers and prison facilities

### apps/web/app/(ops)/transport/outbound/page.tsx
Page now has three sections:
1. **Warehouse Inventory** (unchanged) — `at_warehouse` pickups with ageing indicators and Create Outbound Shipment button
2. **Active Outbound Shipments** — table with Mark In Transit (status=created) or Mark Delivered (status=in_transit) buttons; Mark Delivered cascades to all linked pickups per TRANS-10
3. **Completed Shipments** (collapsible `<details>`) — read-only table of delivered shipments from the last 30 days

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing markOutboundInTransit action**
- **Found during:** Task 2
- **Issue:** The outbound page plan required a "Mark In Transit" button calling `markOutboundInTransit`, but that function did not exist in `transport/outbound/actions.ts` — only `markOutboundDelivered` was present.
- **Fix:** Added `markOutboundInTransit(shipmentId)` to `actions.ts` following the same pattern as `markOutboundDelivered`: updates `outbound_shipments.status='in_transit'` (plus `dispatched_at`), then cascades `pickups.status='in_transit'` to all linked pickups.
- **Files modified:** apps/web/app/(ops)/transport/outbound/actions.ts
- **Commit:** e081a3d

## Known Stubs

None — all data flows are fully wired. The proof of delivery link renders only when `proof_of_delivery_path` exists on the booking row (which is set by transport providers via a separate upload flow not in scope for Phase 4).

## Self-Check: PASSED
