---
phase: 08-dashboards-and-esg-metrics
plan: "06"
subsystem: ui
tags: [transport, dashboard, stats, warehouse, consolidation, nextjs, server-components]

requires:
  - phase: 04-pickup-booking-and-transport-management
    provides: transport_bookings, transport_providers, outbound_shipments, getAssignedPickups action

provides:
  - TransportStats component showing 4 pickup-status stat cards
  - WarehouseInventorySection component with ageing indicators and outbound history
  - getTransportProviderInfo() — resolves provider type for current transport user
  - getWarehouseInventory() — at_warehouse pickups with days_held ageing
  - getOutboundShipmentHistory() — last 30 days outbound shipments with pickup count
  - Conditional warehouse section for consolidation providers in transport portal

affects: [09-notifications-and-manuals]

tech-stack:
  added: []
  patterns:
    - Parallel Promise.all data fetch for consolidation-specific sections (conditional fetch, not always run)
    - Server Component stat cards with grid layout pattern (2-col mobile, 4-col sm+)
    - Ageing colour logic in table cells (green <7d, amber 7-14d, red >14d)

key-files:
  created:
    - apps/web/app/(ops)/transport/portal/components/transport-stats.tsx
    - apps/web/app/(ops)/transport/portal/components/warehouse-inventory-section.tsx
  modified:
    - apps/web/app/(ops)/transport/portal/page.tsx
    - apps/web/app/(ops)/transport/portal/actions.ts

key-decisions:
  - "Promise.all used for conditional consolidation fetches — both run in parallel only when provider_type=consolidation"
  - "Warehouse section positioned after tabs so pickup queue remains primary content for all transport users"
  - "getTransportProviderInfo queries transport_providers via user_id match under RLS context"

patterns-established:
  - "Conditional data fetches gated on provider_type before parallel Promise.all"
  - "Ageing heat-map colours: green/amber/red thresholds at 7 and 14 days"

requirements-completed: [DASH-05]

duration: 8min
completed: 2026-03-21
---

# Phase 8 Plan 06: Transport Dashboard Stats and Warehouse Inventory Summary

**Transport portal enhanced with 4-card stat summary and consolidation-provider warehouse inventory section with ageing indicators and outbound shipment history**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-21T09:50:00Z
- **Completed:** 2026-03-21T09:58:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- TransportStats renders a 4-card grid (Awaiting Collection, In Transit, At Warehouse, Completed 30d) derived from existing getAssignedPickups data
- WarehouseInventorySection renders two sub-sections: at-warehouse pickups with day-ageing colour coding, and outbound shipment history (last 30 days)
- Three new server actions added to actions.ts: getTransportProviderInfo, getWarehouseInventory, getOutboundShipmentHistory
- Consolidation providers see the full warehouse section; direct providers see only stats and tabs — no UI shown for direct providers

## Task Commits

1. **Task 1: Transport dashboard stats and warehouse inventory** - `6758cce` (feat)

**Plan metadata:** see final commit below

## Files Created/Modified

- `apps/web/app/(ops)/transport/portal/components/transport-stats.tsx` — 4-card stat grid, server component
- `apps/web/app/(ops)/transport/portal/components/warehouse-inventory-section.tsx` — warehouse inventory + outbound history tables with ageing colours
- `apps/web/app/(ops)/transport/portal/actions.ts` — extended with getTransportProviderInfo, getWarehouseInventory, getOutboundShipmentHistory
- `apps/web/app/(ops)/transport/portal/page.tsx` — wires stat cards, calls provider info, conditionally renders warehouse section after tabs

## Decisions Made

- Promise.all used for parallel conditional fetches when provider is consolidation, to avoid sequential await latency
- Warehouse section placed after the existing tab/table area so the pickup queue remains the primary surface for all transport users
- getOutboundShipmentHistory uses a loop over shipment IDs to count pickups per shipment — avoids GROUP BY complexity in Drizzle ORM for small shipment counts

## Deviations from Plan

None - plan executed exactly as written. All three actions and both components were already scaffolded; page.tsx required the wiring step.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Transport dashboard DASH-05 complete; all four pickup status counts visible to transport users
- Consolidation providers see full warehouse inventory with ageing and outbound history
- Ready for Phase 9 notifications work

---
*Phase: 08-dashboards-and-esg-metrics*
*Completed: 2026-03-21*

## Self-Check: PASSED

- FOUND: transport-stats.tsx
- FOUND: warehouse-inventory-section.tsx
- FOUND: page.tsx
- FOUND: SUMMARY.md
- FOUND: commit 6758cce
