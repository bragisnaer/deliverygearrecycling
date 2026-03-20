---
phase: 04-pickup-booking-and-transport-management
plan: "08"
subsystem: transport-portal
tags: [transport, portal, rls, server-actions, proof-of-delivery]
dependency_graph:
  requires: ["04-01"]
  provides: ["TRANS-08"]
  affects: ["04-05", "04-06", "04-07", "04-09"]
tech_stack:
  added: []
  patterns:
    - "requireTransport() auth helper — checks role='transport', returns sub for withRLSContext"
    - "Inline Server Actions in JSX (server-side form action closures) for status button forms"
    - "RLS-scoped DB query in Server Component via requireAuth() + withRLSContext()"
key_files:
  created:
    - apps/web/app/(ops)/transport/portal/actions.ts
    - apps/web/app/(ops)/transport/portal/page.tsx
    - apps/web/app/(ops)/transport/portal/[id]/page.tsx
  modified: []
decisions:
  - "getAssignedPickups() joins transport_bookings+pickups+locations; RLS handles provider isolation automatically — no manual WHERE clause needed for provider scoping"
  - "at_warehouse grouping: rows filtered by status='at_warehouse' in app layer after single DB fetch — avoids N+1 queries"
  - "Inline Server Actions (async ()=>{ 'use server' }) used for status update buttons — avoids extracting thin client components for simple one-field forms"
  - "completed pickups filtered in app layer to last 30 days using Date arithmetic — consistent with existing pattern in pickups/page.tsx"
  - "POD signed URL generated server-side at page render time with 1-hour expiry — no client-side fetch needed"
  - "proof-of-delivery storage bucket path: proof-of-delivery/{bookingId}/{timestamp}-{filename} — namespaced by booking ID for easy cleanup"
metrics:
  duration_seconds: ~900
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 04 Plan 08: Transport Provider Portal Summary

**One-liner:** Transport provider self-service portal with RLS-scoped pickup listing, four-tab status grouping, status transitions (picked_up/in_transit/at_warehouse), delivery notes, and proof-of-delivery upload — no pricing or prison data exposed.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create transport portal Server Actions | eaadfa4 | apps/web/app/(ops)/transport/portal/actions.ts |
| 2 | Create transport portal pages | a4310cb | apps/web/app/(ops)/transport/portal/page.tsx, apps/web/app/(ops)/transport/portal/[id]/page.tsx |

## What Was Built

### Server Actions (`portal/actions.ts`)

- `requireTransport()` — checks `session.user.role === 'transport'`, returns `{ ...user, sub: user.id! }` for RLS context
- `getAssignedPickups()` — single JOIN query (transport_bookings + pickups + locations), grouped into four buckets: `awaiting_collection`, `at_warehouse`, `in_transit`, `completed` (last 30 days). Explicitly selects only safe columns — no `transport_cost_market_to_destination_eur`, no `prison_facility_id`
- `updateShipmentStatus(bookingId, 'picked_up' | 'in_transit')` — validates allowed transitions (transport_booked→picked_up, picked_up→in_transit), updates both `pickups.status` and `transport_bookings.updated_at`
- `markArrivedAtWarehouse(bookingId)` — validates `transport_type='consolidation'` and `pickup.status='picked_up'`, transitions pickup to `at_warehouse`, revalidates both `/transport/portal` and `/transport/outbound`
- `addDeliveryNotes(bookingId, notes)` — updates `delivery_notes` with 2000-char limit validation
- `uploadProofOfDelivery(bookingId, formData)` — validates file type (JPEG/PNG/WebP/PDF) and size (≤10MB), uploads to `proof-of-delivery/{bookingId}/{timestamp}-{filename}`, updates `proof_of_delivery_path` on booking

### Portal List Page (`portal/page.tsx`)

- `requireAuth(['transport'])` gate
- Four tab navigation using URL search param `?tab=`
- Per-tab row counts shown in tab badge
- `PickupTable` component renders reference, location name/address, pallet count, transport type badge, date, link to detail
- No pricing columns anywhere

### Portal Detail Page (`portal/[id]/page.tsx`)

- `requireAuth(['transport'])` + `withRLSContext` directly for booking fetch (RLS restricts to provider's own bookings)
- Details grid: status badge, pallet count, preferred date, confirmed pickup date
- Transport type badge (Direct / Consolidation)
- Status action buttons (inline Server Actions):
  - "Mark Picked Up" — shown when `status='transport_booked'`
  - "Mark In Transit" — shown when `status='picked_up'` AND `transport_type='direct'`
  - "Mark Arrived at Warehouse" — shown when `status='picked_up'` AND `transport_type='consolidation'`
- Delivery notes textarea with "Save Notes" button
- POD upload with file input (accepts image/pdf, max 10MB); existing POD shown as signed download link
- Zero pricing or prison data in any field

## Security Properties (TRANS-08)

- Transport providers see ONLY their linked clients' pickups (via RLS `EXISTS` subquery on `transport_provider_clients → transport_providers.user_id = JWT sub`)
- `getAssignedPickups()` and detail page fetch explicitly omit `transport_cost_market_to_destination_eur` and `prison_facility_id`
- `requireTransport()` throws if role is not exactly `'transport'`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all actions wire to real DB queries; portal pages display live data.

## Self-Check: PASSED

- FOUND: apps/web/app/(ops)/transport/portal/actions.ts
- FOUND: apps/web/app/(ops)/transport/portal/page.tsx
- FOUND: apps/web/app/(ops)/transport/portal/[id]/page.tsx
- FOUND commit: eaadfa4 (feat(04-08): create transport portal Server Actions)
- FOUND commit: a4310cb (feat(04-08): create transport provider portal pages)
- TypeScript: no errors in portal files (one pre-existing unrelated error in (client)/pickups/actions.test.ts)
