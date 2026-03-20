---
phase: 04-pickup-booking-and-transport-management
plan: 05
subsystem: transport
tags: [server-actions, zod, drizzle, next.js, transport-booking, rls]

# Dependency graph
requires:
  - phase: 04-pickup-booking-and-transport-management
    provides: "transport schema (transportBookings, transportProviders), pickup schema with status enum, prisonFacilities"
  - phase: 04-03
    provides: "confirmPickup and cancelPickup server actions, requireRecoAdmin helper, withRLSContext pattern"
  - phase: 04-04
    provides: "transport provider CRUD and provider client join table"
provides:
  - bookDirectTransport server action — inserts transport_booking with type=direct, prison_facility_id, cost, date; advances pickup to transport_booked
  - bookConsolidationTransport server action — inserts transport_booking with type=consolidation, prison_facility_id=null, cost, date; advances pickup to transport_booked
  - Book Transport page at /pickups/[id]/book-transport with direct/consolidation type selector
  - BookTransportForm client component with conditional prison dropdown and provider filtering
affects: [04-06, 04-07, 04-08, 04-09, 04-10, transport-portal, outbound-shipments]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server Action form submission with FormData.get() extraction + Zod safeParse"
    - "Client component form wrapper with useTransition + server action dispatch pattern"
    - "Conditional field rendering via React state (transportType toggle hides prison dropdown)"
    - "Provider list filtered client-side by transport type selection"

key-files:
  created:
    - apps/web/app/(ops)/pickups/[id]/book-transport/page.tsx
    - apps/web/app/(ops)/pickups/[id]/book-transport/book-transport-form.tsx
  modified:
    - apps/web/app/(ops)/pickups/actions.ts
    - apps/web/app/(ops)/pickups/[id]/page.tsx

key-decisions:
  - "BookTransportForm extracted as client component — React state needed for transport type toggle; page.tsx stays pure Server Component for data fetching"
  - "Provider dropdown filtered client-side by transport type — avoids round-trip to server on type switch"
  - "book-transport-form.tsx uses useTransition + manual FormData construction — consistent with existing confirm-pickup-button.tsx pattern in codebase"
  - "Pickup detail page Book Transport link updated from /transport/new?pickup_id=... to /pickups/[id]/book-transport — contextual navigation per CONTEXT decision"

patterns-established:
  - "Server Action + client form wrapper: page fetches data as Server Component, form is 'use client' wrapper calling server actions"
  - "Status guard pattern: fetch pickup, check status, return { error } if wrong, proceed if correct"

requirements-completed: [TRANS-03, TRANS-04]

# Metrics
duration: 12min
completed: 2026-03-20
---

# Phase 04 Plan 05: Transport Booking Flow Summary

**Direct and consolidation transport booking via Server Actions with FormData Zod validation, conditional prison dropdown, and pickup status advancement to transport_booked**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-20T18:20:00Z
- **Completed:** 2026-03-20T18:32:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- bookDirectTransport Server Action: validates confirmed status, inserts transport_bookings row with transport_type=direct and prison_facility_id, updates pickup status to transport_booked
- bookConsolidationTransport Server Action: same flow with transport_type=consolidation and prison_facility_id=null (warehouse destination)
- Book Transport page at /pickups/[id]/book-transport: server-fetches pickup (redirects if not confirmed), providers, and prison facilities
- BookTransportForm client component: radio type selector toggles prison dropdown visibility and filters provider list by type

## Task Commits

1. **Task 1: Add bookDirectTransport and bookConsolidationTransport Server Actions** - `c17dbd5` (feat)
2. **Task 2: Create Book Transport page with type selection and provider/prison selectors** - `8462c5c` (feat)

## Files Created/Modified

- `apps/web/app/(ops)/pickups/actions.ts` - Added directTransportSchema, consolidationTransportSchema, bookDirectTransport, bookConsolidationTransport; added transportBookings/transportProviders/prisonFacilities imports
- `apps/web/app/(ops)/pickups/[id]/book-transport/page.tsx` - Server Component; requireAuth(['reco-admin']); fetches pickup, providers, prison facilities; redirects if pickup not confirmed
- `apps/web/app/(ops)/pickups/[id]/book-transport/book-transport-form.tsx` - Client Component; direct/consolidation radio toggle; filtered provider dropdown; conditional prison facility dropdown; cost input; date input; dispatches bookDirectTransport or bookConsolidationTransport
- `apps/web/app/(ops)/pickups/[id]/page.tsx` - Updated Book Transport link from /transport/new?pickup_id=... to /pickups/[id]/book-transport

## Decisions Made

- BookTransportForm extracted as client component — React state needed for transport type toggle; page.tsx stays pure Server Component for data fetching (consistent with PickupBookingForm pattern from plan 04-02)
- Provider list filtered client-side by transport type to avoid server round-trip on type switch
- Detail page link updated to contextual route /pickups/[id]/book-transport per CONTEXT decision: "reco-admin books transport from within the pickup detail page"

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Transport booking flow complete; pickups can now advance to transport_booked status
- Ready for plan 04-06: transport portal pickup list (transport role views assigned pickups)
- bookDirectTransport and bookConsolidationTransport actions available for future transport status update flows

---
*Phase: 04-pickup-booking-and-transport-management*
*Completed: 2026-03-20*
