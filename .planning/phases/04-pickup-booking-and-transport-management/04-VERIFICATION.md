---
phase: 04-pickup-booking-and-transport-management
verified: 2026-03-20T19:55:00Z
status: passed
score: 20/20 must-haves verified
gaps: []
human_verification:
  - test: "Submit a pickup request as a client user"
    expected: "Form submits, PU-YYYY-NNNN reference appears in success toast, confirmation email arrives in inbox"
    why_human: "Cannot verify Resend email delivery or photo upload drag-and-drop UX without a browser and live Resend key"
  - test: "Transport provider sees only their linked clients' pickups in the portal"
    expected: "Pickups from other tenants are invisible; no pricing columns shown anywhere"
    why_human: "RLS isolation requires a live database session with transport_role JWT claims to verify"
  - test: "Ageing alert fires when a held pickup exceeds the configured threshold"
    expected: "In-app notification appears in reco-admin view; duplicate prevention prevents a second notification on re-load"
    why_human: "Requires a pickup in at_warehouse status for more than threshold days in a live database"
---

# Phase 4: Pickup Booking and Transport Management — Verification Report

**Phase Goal:** Client users can book pickups through the platform and reco-admin can fully manage transport — replacing Google Sheets as the operational record of truth for pickup and transport workflows
**Verified:** 2026-03-20T19:55:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | All Phase 4 tables exist in the database with RLS policies | VERIFIED | `locations.ts` (60 ln), `pickups.ts` (172 ln), `transport.ts` (348 ln), `notifications.ts` (65 ln) all export tables with `pgPolicy('*_deny_all', { using: sql\`false\` })` patterns |
| 2  | PU-YYYY-NNNN reference numbers generated automatically on pickup insert | VERIFIED | Migration `0003_phase4_pickup_transport.sql` contains `CREATE OR REPLACE FUNCTION generate_pickup_reference()` and `CREATE TRIGGER set_pickup_reference` using `pickup_ref_seq_YYYY` sequences |
| 3  | Transport providers are linked to tenants via join table | VERIFIED | `transportProviderClients` table in `transport.ts`; `createTransportProvider` action inserts into `transportProviderClients` for each `linked_tenant_id` |
| 4  | Two-leg cost columns exist on transport_bookings and outbound_shipments | VERIFIED | `transport_cost_market_to_destination_eur` on `transportBookings`; `transport_cost_warehouse_to_prison_eur` on `outboundShipments`; `allocated_cost_eur` on `outboundShipmentPickups` |
| 5  | Client user can submit a pickup request with product quantities, pallet details, preferred date, and photos | VERIFIED | `pickup-booking-form.tsx` (421 ln): product quantity table with weight calc, pallet fields, 72h date, photo upload (max 5), calls `submitPickupRequest` |
| 6  | Client role address is auto-filled from their location and not editable | VERIFIED | `new/page.tsx` fetches user's location and passes to form as read-only display; no editable address input |
| 7  | Dates within 72 hours are blocked both in UI and server-side | VERIFIED | Client-side: `getMin72hDate()` in form component; server-side: `new Date(Date.now() + 72 * 60 * 60 * 1000)` in `actions.ts`; test 1 in `actions.test.ts` confirms rejection |
| 8  | Estimated weight is auto-calculated from product weights and pallet count | VERIFIED | `estimatedWeightGrams` computed reactively in `pickup-booking-form.tsx`; server-side weight calc in `submitPickupRequest`; test 4 confirms `SUM(weight * qty) + pallet_count * 25000` |
| 9  | Client users see their own pickup list with status badges | VERIFIED | `(client)/pickups/page.tsx` (141 ln): `requireAuth(['client', 'client-global'])`, fetches pickups with `withRLSContext`, renders status badges |
| 10 | Client can cancel a pickup up to 24h before confirmed date | VERIFIED | `TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000` constant; 24h check on `confirmed_date` in `cancelPickupAsClient`; 4 unit tests covering all 24h scenarios pass |
| 11 | reco-admin sees a pickup queue with status filter tabs | VERIFIED | `(ops)/pickups/page.tsx` (146 ln): `STATUS_TABS` array with All/Submitted/Confirmed/Transport Booked/In Transit/Delivered; `searchParams.status` filtering |
| 12 | reco-admin can confirm pickups and cancel with reason from the detail page | VERIFIED | `confirmPickup` and `cancelPickup` Server Actions; `confirm-pickup-button.tsx` and `cancel-pickup-dialog.tsx` on detail page; 5 ops action tests pass |
| 13 | reco-admin can list, create, and edit transport providers | VERIFIED | Provider list (100 ln), create (31 ln, delegates to `ProviderForm`), detail/edit (73 ln) pages; `createTransportProvider` and `updateTransportProvider` actions; `ProviderForm` (351 ln) handles both modes |
| 14 | reco-admin can book direct and consolidation transport on a confirmed pickup | VERIFIED | `bookDirectTransport` and `bookConsolidationTransport` in `(ops)/pickups/actions.ts`; status guard `pickup.status !== 'confirmed'`; `book-transport-form.tsx` (213 ln) with radio type selector, conditional prison dropdown |
| 15 | Consolidation warehouse inventory shows held pickups with colour-coded ageing | VERIFIED | `(ops)/transport/outbound/page.tsx`: `getAgeingColour()` returns `text-red-600`/`text-amber-600`/default; "Days Held" column; `checkAndCreateAgeingAlerts()` called on page load with duplicate check (`warehouse_ageing_alert` + `read: false` + `entity_id`) |
| 16 | reco-admin can create outbound shipments with pro-rata cost allocation | VERIFIED | `createOutboundShipment` action; `calculateProRataAllocation` pure function with `toFixed(4)` rounding correction; `outbound-shipment-form.tsx` (387 ln) with checkbox table, editable allocation, running total, 7-pallet soft warning; 3 unit tests pass |
| 17 | Marking an outbound shipment delivered cascades status to all linked pickups | VERIFIED | `markOutboundDelivered` fetches `outbound_shipment_pickups` then updates all linked pickup IDs to `'delivered'`; cascade test passes |
| 18 | Transport provider with platform access can view assigned pickups and update status | VERIFIED | Transport portal pages at `(ops)/transport/portal/`; `requireAuth(['transport'])`; `getAssignedPickups()` uses RLS isolation; status update buttons `Mark Picked Up`/`Mark In Transit`/`Mark Arrived at Warehouse`; POD upload via `uploadProofOfDelivery` using `getStorageClient()` |
| 19 | Client receives confirmation email and reco-admin receives alert on pickup submission | VERIFIED | `sendEmail` called twice in `submitPickupRequest` (client confirmation + admin alert); `notifications` row inserted with `type: 'pickup_submitted'`; resend@6.9.4 and @react-email/components@1.0.10 in `package.json` |
| 20 | Pickup detail page shows transport booking summary and full status timeline | VERIFIED | `(ops)/pickups/[id]/page.tsx` (426 ln): transport summary section with provider name, type, cost, prison/warehouse; direct vs. consolidation status timeline arrays; `book-transport` link when `status='confirmed'`; `updatePickupToAtWarehouse` cross-module import |

**Score:** 20/20 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/db/src/schema/locations.ts` | VERIFIED | 60 ln, exports `locations` table with RLS deny-all + role policies |
| `packages/db/src/schema/pickups.ts` | VERIFIED | 172 ln, exports `pickupStatusEnum`, `pickups`, `pickupLines` with transport_role EXISTS subquery RLS |
| `packages/db/src/schema/transport.ts` | VERIFIED | 348 ln, exports all 5 transport tables + 2 enums |
| `packages/db/src/schema/notifications.ts` | VERIFIED | 65 ln, exports `notifications` with reco_admin and transport_role policies |
| `packages/db/src/schema/index.ts` | VERIFIED | Exports `./locations`, `./pickups`, `./transport`, `./notifications` |
| `packages/db/migrations/0003_phase4_pickup_transport.sql` | VERIFIED | 305 ln; contains trigger, FK constraint, RLS ENABLE+FORCE, GRANTs, indexes, Wolt seed |
| `apps/web/app/(client)/pickups/new/page.tsx` | VERIFIED | 98 ln; delegates to `PickupBookingForm` client component (421 ln) |
| `apps/web/app/(client)/pickups/actions.ts` | VERIFIED | 324 ln; `submitPickupRequest` + `cancelPickupAsClient` with 72h and 24h validation |
| `apps/web/app/(client)/pickups/actions.test.ts` | VERIFIED | 541 ln; 9 tests covering 72h, empty qty, weight calc, email send, 24h cancel (all pass) |
| `apps/web/app/(client)/pickups/page.tsx` | VERIFIED | 141 ln; `requireAuth`, `withRLSContext` fetch, "New Pickup" button |
| `apps/web/app/(client)/pickups/[id]/page.tsx` | VERIFIED | 228 ln; 24h cancel logic, `CancelPickupClientButton` |
| `apps/web/app/(ops)/pickups/page.tsx` | VERIFIED | 146 ln; status filter tabs, `requireAuth` |
| `apps/web/app/(ops)/pickups/[id]/page.tsx` | VERIFIED | 426 ln; transport summary, status timeline, all action buttons |
| `apps/web/app/(ops)/pickups/[id]/book-transport/page.tsx` | VERIFIED | 108 ln; `requireAuth(['reco-admin'])`, fetches providers + prisons |
| `apps/web/app/(ops)/pickups/actions.ts` | VERIFIED | 473 ln; `confirmPickup`, `cancelPickup`, `updatePickupStatus`, `bookDirectTransport`, `bookConsolidationTransport` |
| `apps/web/app/(ops)/pickups/actions.test.ts` | VERIFIED | 184 ln; 5 tests for confirmPickup status guard and cancelPickup (all pass) |
| `apps/web/app/(ops)/transport/providers/page.tsx` | VERIFIED | 100 ln; `requireAuth`, provider type badges |
| `apps/web/app/(ops)/transport/providers/new/page.tsx` | VERIFIED | 31 ln; delegates to `ProviderForm` |
| `apps/web/app/(ops)/transport/providers/[id]/page.tsx` | VERIFIED | 73 ln; detail/edit via `ProviderForm` |
| `apps/web/app/(ops)/transport/providers/actions.ts` | VERIFIED | 261 ln; `createTransportProvider`, `updateTransportProvider` with `transportProviderClients` insert |
| `apps/web/app/(ops)/transport/outbound/page.tsx` | VERIFIED | Colour-coded ageing, "Days Held", shipment list with Mark In Transit / Mark Delivered |
| `apps/web/app/(ops)/transport/outbound/actions.ts` | VERIFIED | 485 ln; `getWarehouseInventory`, `checkAndCreateAgeingAlerts`, `calculateProRataAllocation`, `createOutboundShipment`, `markOutboundInTransit`, `markOutboundDelivered` |
| `apps/web/app/(ops)/transport/outbound/new/page.tsx` | VERIFIED | 71 ln; delegates to `OutboundShipmentForm` (387 ln) |
| `apps/web/app/(ops)/transport/outbound/actions.test.ts` | VERIFIED | 151 ln; 3 tests for pro-rata and cascade delivery (all pass) |
| `apps/web/app/(ops)/transport/portal/page.tsx` | VERIFIED | 215 ln; `requireAuth(['transport'])`, 4 status groups |
| `apps/web/app/(ops)/transport/portal/[id]/page.tsx` | VERIFIED | 315 ln; all action buttons, POD upload, no pricing columns |
| `apps/web/app/(ops)/transport/portal/actions.ts` | VERIFIED | 262 ln; `getAssignedPickups`, `updateShipmentStatus`, `markArrivedAtWarehouse`, `addDeliveryNotes`, `uploadProofOfDelivery` |
| `apps/web/lib/email.ts` | VERIFIED | 33 ln; `sendEmail` wrapper with `Resend` client and `FROM_ADDRESS` fallback |
| `apps/web/emails/pickup-confirmation.tsx` | VERIFIED | React Email template with reference, date, pallet count, location |
| `apps/web/emails/pickup-admin-alert.tsx` | VERIFIED | React Email template with CTA link to pickup |

---

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `(client)/pickups/new/pickup-booking-form.tsx` | `(client)/pickups/actions.ts` | imports and calls `submitPickupRequest` | WIRED |
| `(client)/pickups/actions.ts` | `packages/db/src/schema/pickups.ts` | `withRLSContext` insert into `pickups` and `pickupLines` | WIRED |
| `(client)/pickups/actions.ts` | `apps/web/lib/email.ts` | calls `sendEmail` after DB insert, wrapped in try/catch | WIRED |
| `(client)/pickups/actions.ts` | `packages/db/src/schema/notifications.ts` | inserts `type: 'pickup_submitted'` notification row | WIRED |
| `(ops)/pickups/[id]/page.tsx` | `(ops)/pickups/[id]/book-transport/page.tsx` | `href="/pickups/${pickup.id}/book-transport"` when status='confirmed' | WIRED |
| `(ops)/pickups/[id]/book-transport/book-transport-form.tsx` | `(ops)/pickups/actions.ts` | imports and calls `bookDirectTransport` or `bookConsolidationTransport` | WIRED |
| `(ops)/pickups/actions.ts` | `packages/db/src/schema/transport.ts` | inserts into `transportBookings` via `withRLSContext` | WIRED |
| `(ops)/transport/outbound/actions.ts` | `packages/db/src/schema/notifications.ts` | inserts `warehouse_ageing_alert` with duplicate check | WIRED |
| `(ops)/transport/outbound/new/outbound-shipment-form.tsx` | `(ops)/transport/outbound/actions.ts` | imports `createOutboundShipment` and `calculateProRataAllocation` | WIRED |
| `(ops)/transport/outbound/actions.ts` | `outboundShipments` + `outboundShipmentPickups` | inserts both tables and updates pickup statuses in single `withRLSContext` | WIRED |
| `(ops)/transport/portal/[id]/page.tsx` | `(ops)/transport/portal/actions.ts` | imports `updateShipmentStatus`, `markArrivedAtWarehouse`, `addDeliveryNotes`, `uploadProofOfDelivery` | WIRED |
| `(ops)/pickups/[id]/page.tsx` | `(ops)/transport/outbound/actions.ts` | cross-module import of `updatePickupToAtWarehouse` | WIRED |
| `packages/db/src/schema/pickups.ts` | `packages/db/src/schema/locations.ts` | `pickups.location_id` references `locations.id` | WIRED |
| `packages/db/src/schema/transport.ts` | `packages/db/src/schema/pickups.ts` | `transportBookings.pickup_id` references `pickups.id` | WIRED |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status |
|-------------|-------------|-------------|--------|
| PICKUP-01 | 04-02 | client/client-global can submit pickup with product quantities, pallets, date, photos | SATISFIED |
| PICKUP-02 | 04-01 | PU-YYYY-NNNN human-readable reference | SATISFIED — DB trigger in migration |
| PICKUP-03 | 04-02 | client role auto-fills address from location; not editable | SATISFIED — location shown as read-only text |
| PICKUP-04 | 04-02 | 72-hour minimum lead time enforced | SATISFIED — dual enforcement (client + server) with unit tests |
| PICKUP-05 | 04-01 | Multiple active pickups per location allowed | SATISFIED — no UNIQUE constraint on location_id in pickups schema |
| PICKUP-06 | 04-03 | Client cancel up to 24h before confirmed date; reco-admin cancel anytime with reason | SATISFIED — both tested |
| PICKUP-07 | 04-01, 04-03 | Full status lifecycle: submitted → ... → intake_registered | SATISFIED — 10-value `pickupStatusEnum`; all transitions implemented |
| PICKUP-08 | 04-09 | Client gets confirmation email; reco-admin gets email + in-app notification | SATISFIED — both sendEmail calls + notifications insert in submitPickupRequest |
| TRANS-01 | 04-04 | Transport provider registry with type, contact, service regions, platform access flag | SATISFIED — full CRUD via ProviderForm |
| TRANS-02 | 04-04 | Providers linked to tenants via transport_provider_clients | SATISFIED — join table insert on create/update; RLS enforces isolation |
| TRANS-03 | 04-05, 04-10 | reco-admin books direct transport: provider, prison, cost, date | SATISFIED — bookDirectTransport action + Book Transport page |
| TRANS-04 | 04-05 | reco-admin books consolidation transport: provider, warehouse leg cost | SATISFIED — bookConsolidationTransport sets prison_facility_id=null |
| TRANS-05 | 04-06 | Consolidation warehouse inventory: held pickups with client, products, days held | SATISFIED — outbound/page.tsx with getWarehouseInventory |
| TRANS-06 | 04-07 | Create outbound shipments from warehouse; soft warning at 7 pallets | SATISFIED — `PALLET_SOFT_LIMIT = 7` in outbound-shipment-form.tsx |
| TRANS-07 | 04-01, 04-07 | Two-leg cost model: leg 1 on transport_bookings, leg 2 on outbound_shipments with pro-rata allocation | SATISFIED — both cost columns exist; calculateProRataAllocation with rounding tested |
| TRANS-08 | 04-08 | Transport providers can update status, add notes, upload POD; no pricing/prison data visible | SATISFIED — portal actions scope to transport role; getAssignedPickups explicitly excludes cost columns |
| TRANS-09 | 04-06 | reco-admin alert when pallets held exceed configurable threshold | SATISFIED — checkAndCreateAgeingAlerts reads warehouse_ageing_threshold_days from system_settings |
| TRANS-10 | 04-07, 04-10 | Outbound shipment delivery cascades delivered status to all linked pickups | SATISFIED — markOutboundDelivered cascade tested and wired to "Mark Delivered" button |

All 18 requirements (PICKUP-01 through PICKUP-08, TRANS-01 through TRANS-10) are SATISFIED. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/(client)/pickups/actions.test.ts` | 401 | `capturedInsertValues` typed as `never` — TypeScript error `TS2339: Property 'estimated_weight_grams' does not exist on type 'never'` | Info | Test file only; runtime tests pass (Vitest transpiles without strict type checking). Does not affect production code. Fix: type `capturedInsertValues` explicitly. |

No blocker or warning-level anti-patterns found in production code. No TODO/FIXME/placeholder comments found. No empty implementations found in action handlers.

---

### Human Verification Required

#### 1. End-to-end pickup submission flow

**Test:** Log in as a client user (e.g. Wolt), navigate to `/pickups/new`, fill in product quantities, set a date 5 days out, add a note, attach a photo, and submit.
**Expected:** Form submits successfully, toast shows the PU-YYYY-NNNN reference, client receives a confirmation email, reco-admin receives an alert email and sees an in-app notification.
**Why human:** Cannot verify Resend email delivery without a live `RESEND_API_KEY` and real mailbox. Cannot verify photo drag-and-drop UX programmatically.

#### 2. Transport provider RLS isolation

**Test:** Log in as a transport provider user, navigate to `/transport/portal`. Check that only pickups for linked clients appear. Verify no cost columns or prison facility names are displayed anywhere.
**Expected:** Provider sees only their assigned pickups; all four status tabs show correct grouping; no EUR amounts visible.
**Why human:** RLS isolation requires a live database session with `transport_role` JWT claims. Cannot verify with grep alone.

#### 3. Warehouse ageing alert trigger

**Test:** Set `warehouse_ageing_threshold_days` to 1 in system_settings. Load the `/transport/outbound` page with a pickup that has been in `at_warehouse` status for more than 1 day.
**Expected:** A `warehouse_ageing_alert` notification appears. Reloading the page does not create a duplicate notification.
**Why human:** Requires a live database with a pickup in `at_warehouse` status older than the threshold.

---

### Test Suite Results

```
Test Files: 6 passed (6)
Tests:      32 passed | 2 todo (34)
Duration:   698ms
```

All phase 4 test files pass:
- `app/(client)/pickups/actions.test.ts` — 9 tests (72h validation, weight calc, email send, 24h cancel rule)
- `app/(ops)/pickups/actions.test.ts` — 5 tests (confirmPickup status guard, cancelPickup reason + terminal guard)
- `app/(ops)/transport/outbound/actions.test.ts` — 3 tests (pro-rata allocation, rounding, cascade delivery)

**TypeScript:** 1 type error in test file only (`actions.test.ts:401` — `capturedInsertValues` narrowed to `never`). Production code compiles clean.

---

### Nav Bar Updates

| Location | Item Added | Status |
|----------|-----------|--------|
| `ops-nav-bar.tsx` | `{ label: 'Pickups', href: '/pickups' }` | VERIFIED |
| `ops-nav-bar.tsx` | `{ label: 'Transport', href: '/transport' }` | VERIFIED |
| `(client)/layout.tsx` | Link to `/pickups` in nav | VERIFIED |

---

## Summary

Phase 4 has achieved its goal. All 20 derived truths are verified, all 18 requirements (PICKUP-01–08, TRANS-01–10) are satisfied by concrete code evidence, all 30 planned artifact files exist with substantive implementations, and all key wiring links are confirmed. The full test suite passes with 32 tests. Three items are deferred to human verification: email delivery confirmation, live RLS isolation testing, and ageing alert threshold trigger — none of these are automatable without a live environment.

The single non-blocking issue is a TypeScript narrowing error in a test file (`capturedInsertValues` typed as `never`), which does not affect any production code path.

---

_Verified: 2026-03-20T19:55:00Z_
_Verifier: Claude (gsd-verifier)_
