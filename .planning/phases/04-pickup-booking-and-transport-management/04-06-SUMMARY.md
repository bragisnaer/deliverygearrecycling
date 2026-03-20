---
phase: 04-pickup-booking-and-transport-management
plan: "06"
subsystem: transport
tags: [warehouse, inventory, ageing, notifications, transport]
dependency_graph:
  requires: ["04-03", "04-04"]
  provides: ["warehouse-inventory-page", "ageing-alert-notifications"]
  affects: ["04-07"]
tech_stack:
  added: []
  patterns:
    - "inArray from drizzle-orm for multi-ID pickup line queries"
    - "Non-blocking try/catch for alert creation in Server Component"
    - "Ageing colour logic extracted to pure helper function getAgeingColour()"
key_files:
  created:
    - apps/web/app/(ops)/transport/outbound/actions.ts
    - apps/web/app/(ops)/transport/outbound/page.tsx
  modified: []
decisions:
  - "checkAndCreateAgeingAlerts wrapped in try/catch in page — alert creation failure is non-critical and must not break page render for transport role users who cannot insert notifications"
  - "inArray used for pickup lines query instead of fetch-all-and-filter — correct Drizzle pattern found in existing codebase (client/pickups/actions.ts)"
  - "requireRecoAdminOrTransport helper created — getWarehouseInventory must be accessible to both reco-admin and transport roles"
metrics:
  duration_seconds: 227
  completed_date: "2026-03-20T18:23:50Z"
  tasks_completed: 2
  files_changed: 2
---

# Phase 04 Plan 06: Warehouse Inventory with Ageing Alerts Summary

Consolidation warehouse inventory page with colour-coded ageing display and duplicate-prevented in-app alert notifications for threshold breaches.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create warehouse inventory Server Actions with ageing alert logic | d3e3d41 | apps/web/app/(ops)/transport/outbound/actions.ts |
| 2 | Create warehouse inventory page with colour-coded ageing table | 6f29522 | apps/web/app/(ops)/transport/outbound/page.tsx |

## What Was Built

**actions.ts** (`getWarehouseInventory`, `checkAndCreateAgeingAlerts`, `updatePickupToAtWarehouse`):

- `getWarehouseInventory()`: Fetches all `at_warehouse` pickups joined with locations, transport_bookings, transport_providers, and pickup_lines+products. Computes `days_held` from `pickup.updated_at` timestamp arithmetic. Reads `warehouse_ageing_threshold_days` from `systemSettings` (default 14 if settings row absent).
- `checkAndCreateAgeingAlerts()`: For each pickup where `days_held > threshold`, checks for an existing unread `warehouse_ageing_alert` notification with matching `entity_id` before inserting — prevents duplicate alerts per research Pitfall 7.
- `updatePickupToAtWarehouse()`: Validates consolidation transport booking exists before setting `status='at_warehouse'`, revalidates `/transport/outbound`.

**page.tsx** (Server Component):

- Auth-guarded for `reco-admin`, `reco`, `transport` roles.
- Calls `getWarehouseInventory()` + `checkAndCreateAgeingAlerts()` (non-blocking try/catch).
- Table columns: Reference (linked to pickup detail), Client/Location, Products (name × qty list), Pallets, Warehouse, Arrival Date, Days Held.
- Days Held colour-coding: `text-green-600` (<7 days), `text-amber-600` (7d to threshold), `text-red-600 font-semibold` (≥threshold).
- Empty state: "No pickups currently held at warehouses".
- "Create Outbound Shipment" button links to `/transport/outbound/new` (built in plan 07).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pickup lines multi-ID query using inArray**
- **Found during:** Task 1 implementation
- **Issue:** Initial implementation used a flawed workaround (fetch-all + JS filter) for querying pickup lines across multiple pickup IDs
- **Fix:** Used `inArray(pickupLines.pickup_id, pickupIds)` from drizzle-orm — confirmed available via existing codebase pattern in `apps/web/app/(client)/pickups/actions.ts`
- **Files modified:** apps/web/app/(ops)/transport/outbound/actions.ts
- **Commit:** d3e3d41

## Known Stubs

None — page fetches live data from the database via `getWarehouseInventory()`.

## Self-Check: PASSED
