---
phase: 04-pickup-booking-and-transport-management
plan: 01
subsystem: database
tags: [drizzle-orm, postgres, rls, row-level-security, schema, migrations, pickups, transport]

# Dependency graph
requires:
  - phase: 03-product-registry
    provides: products table (pickup_lines.product_id FK), pgTable/pgPolicy pattern
  - phase: 01-infrastructure-foundation
    provides: DB roles (reco_admin, reco_role, client_role, transport_role), withRLSContext, tenants, users, prison_facilities tables

provides:
  - locations table with tenant_id RLS (pickup locations for client users)
  - pickups table with pickupStatusEnum (10 values) and PU-YYYY-NNNN auto-reference trigger
  - pickupLines table for per-product-type line items
  - transportProviders table with user_id → JWT sub RLS
  - transportProviderClients join table (provider ↔ tenant)
  - transportBookings table with two-leg cost model (leg 1: market→destination)
  - outboundShipments table (leg 2: warehouse→prison)
  - outboundShipmentPickups join table with allocated_cost_eur
  - notifications table for in-app alerts
  - standard_pallet_weight_grams added to system_settings
  - users.location_id FK constraint to locations

affects:
  - 04-02 through 04-10 (all subsequent phase 4 plans depend on these tables)
  - phase 05 (prison intake uses pickup_id FKs)
  - phase 07 (invoice tracking references transport_bookings, outbound_shipments)
  - phase 08 (ESG metrics aggregate from pickups and transport data)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pgTable with deny-all restrictive policy + permissive per-role grants (extended to transport_role)"
    - "transport_role RLS uses user_id::text = current_setting('request.jwt.claim.sub', true)"
    - "Two-leg transport cost model: leg 1 on transport_bookings, leg 2 on outbound_shipments"
    - "PU-YYYY-NNNN per-year sequence trigger using dynamic CREATE SEQUENCE IF NOT EXISTS"
    - "FK to users.location_id added via raw migration SQL (not Drizzle schema) per research anti-pattern guidance"

key-files:
  created:
    - packages/db/src/schema/locations.ts
    - packages/db/src/schema/pickups.ts
    - packages/db/src/schema/transport.ts
    - packages/db/src/schema/notifications.ts
    - packages/db/migrations/0003_phase4_pickup_transport.sql
    - packages/db/migrations/0003_worthless_quicksilver.sql
  modified:
    - packages/db/src/schema/index.ts

key-decisions:
  - "pickups.transport_role RLS uses EXISTS subquery on transport_provider_clients JOIN transport_providers.user_id = JWT sub — same pattern as product_materials EXISTS subquery for tenant isolation via parent table"
  - "pickupLines RLS uses EXISTS subquery on parent pickups.tenant_id matching product_materials pattern (no direct tenant_id column)"
  - "standard_pallet_weight_grams added to system_settings as integer NOT NULL DEFAULT 25000 via raw migration ALTER COLUMN"
  - "Two migration files coexist: 0003_worthless_quicksilver.sql (drizzle-kit: tables, enums, enable RLS, policies) + 0003_phase4_pickup_transport.sql (manual: trigger, users FK, FORCE RLS, GRANTs, seed)"
  - "notifications deny-all + reco_admin + transport_role only (no client_role access — clients do not read notifications via DB directly in phase 4)"

patterns-established:
  - "transport_role JWT sub pattern: user_id::text = current_setting('request.jwt.claim.sub', true)"
  - "Chained EXISTS subquery for transport_role: transport_provider_clients JOIN transport_providers WHERE user_id = JWT sub"
  - "PU-YYYY-NNNN trigger: per-year sequences via EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I', seq_name)"

requirements-completed: [PICKUP-02, PICKUP-05, PICKUP-07, TRANS-01, TRANS-02, TRANS-07]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 4 Plan 01: Pickup and Transport Schema Summary

**Drizzle ORM schema + migration SQL for 9 new tables (locations, pickups, pickup_lines, transport_providers, transport_provider_clients, transport_bookings, outbound_shipments, outbound_shipment_pickups, notifications) with RLS deny-all policies, PU-YYYY-NNNN reference trigger, users.location_id FK, and standard_pallet_weight_grams system setting**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-20T17:40:31Z
- **Completed:** 2026-03-20T17:44:53Z
- **Tasks:** 2
- **Files modified:** 7 (4 created schema files, 1 updated index, 2 migration SQL files)

## Accomplishments

- Four Drizzle ORM schema files with complete RLS policies (deny-all restrictive + permissive per-role)
- Manual migration SQL covering PU-YYYY-NNNN trigger, FK constraint, FORCE RLS, GRANTs, and Wolt seed location
- Drizzle-kit generated migration for table CREATE statements, enums, and policy DDL
- TypeScript compilation passes with zero errors across all new schema files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create locations, pickups, transport, and notifications schema files** - `4e16490` (feat)
2. **Task 2: Create migration SQL with RLS enable, PU-YYYY-NNNN trigger, FK constraints, and system settings update** - `7315314` (feat)
3. **Drizzle-kit generated migration** - `8ae7460` (chore)

## Files Created/Modified

- `packages/db/src/schema/locations.ts` - locations table: tenant-scoped with country, RLS for reco_admin/reco/client roles
- `packages/db/src/schema/pickups.ts` - pickupStatusEnum + pickups + pickupLines tables, transport_role EXISTS-subquery RLS
- `packages/db/src/schema/transport.ts` - transportTypeEnum + outboundShipmentStatusEnum + 5 transport tables, two-leg cost model
- `packages/db/src/schema/notifications.ts` - notifications table for in-app alerts, reco_admin + transport_role access
- `packages/db/src/schema/index.ts` - added 4 new exports
- `packages/db/migrations/0003_phase4_pickup_transport.sql` - manual migration: trigger, FK, FORCE RLS, GRANTs, seed
- `packages/db/migrations/0003_worthless_quicksilver.sql` - drizzle-kit generated: CREATE TABLE, enums, ENABLE RLS, policies

## Decisions Made

- Used chained EXISTS subquery for transport_role on pickups table (matching product_materials pattern): `transport_provider_clients JOIN transport_providers WHERE user_id = JWT sub` — avoids denormalized tenant_id on every table
- Two migration files intentionally coexist: drizzle-kit handles CREATE TABLE/enum/policy DDL; manual SQL handles trigger function, users.location_id FK (not modifiable via Drizzle schema file), FORCE RLS, role GRANTs, and development seed data
- notifications table omits client_role policy (fail-closed) — client users receive in-app notifications via future application-layer queries, not direct DB access in phase 4

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — TypeScript compiled with zero errors on first attempt. Drizzle-kit generate succeeded and produced a complementary migration alongside the manual one.

## User Setup Required

None — no external service configuration required. Migration SQL will be applied to the database during Phase 4 deployment setup.

## Next Phase Readiness

All Phase 4 foundational tables exist in Drizzle schema and migration SQL. Plans 04-02 through 04-10 can proceed:
- `pickups` table available for pickup booking API (04-02)
- `transport_bookings` available for transport assignment workflow (04-03, 04-04)
- `outbound_shipments` available for consolidation management (04-05, 04-06)
- `notifications` table available for event-driven alerts (04-10)
- No blockers for subsequent plans

---
*Phase: 04-pickup-booking-and-transport-management*
*Completed: 2026-03-20*
