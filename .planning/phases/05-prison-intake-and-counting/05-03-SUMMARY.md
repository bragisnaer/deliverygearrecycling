---
phase: 05-prison-intake-and-counting
plan: 03
subsystem: prison-intake-ui
tags: [next-intl, server-actions, drizzle, rls, prison-role, card-grid, server-component]

# Dependency graph
requires:
  - phase: 05-01
    provides: intake_records schema, prison_role RLS, intakeRecords table
  - phase: 05-02
    provides: prison layout, login, session pattern (auth() + requirePrisonSession pattern)
  - phase: 04-pickup-booking-and-transport-management
    provides: pickups, transport_bookings, outbound_shipments, outbound_shipment_pickups tables
provides:
  - getExpectedDeliveries Server Action (apps/web/app/prison/actions.ts)
  - requirePrisonSession auth guard for prison role
  - ExpectedDelivery and DeliveryGroup types (exported)
  - /prison/incoming page with direct and consolidated delivery card grid
affects:
  - 05-04+ (intake form plans link from /prison/intake/[id] — routes now have navigation source)
  - 05-08 (unexpected delivery at /prison/intake/new — entry point visible)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - requirePrisonSession: auth() + role === 'prison' check + sub: user.id! mapping
    - prison-role withRLSContext: same pattern as requireRecoAdmin in pickups/actions.ts
    - getTranslations('intake'): server-side next-intl string access in Server Component
    - HTML <details>/<summary> for collapsible consolidated shipment cards (no JS dependency)
    - Two-query pattern: main JOIN query then per-pickup lines in second withRLSContext call
    - Derived shipment reference: OS-{id_prefix} since outbound_shipments has no reference column

# Key files
key-files:
  created:
    - apps/web/app/prison/actions.ts
    - apps/web/app/prison/incoming/page.tsx
  modified: []

# Decisions
decisions:
  - outbound_shipments has no reference column — derived OS-{uuid_prefix_8} display reference used; plan spec assumed a reference column that does not exist in schema
  - intakeRecords exclusion join: LEFT JOIN intake_records ON pickup_id + WHERE id IS NULL — standard anti-join pattern to exclude already-registered deliveries
  - HTML <details> element for collapsible consolidated cards — no @base-ui Collapsible installed; native HTML requires no JS dependency and tablet-compatible
  - Two separate withRLSContext calls for main query and lines fetch — Drizzle cannot do lateral joins easily; N+1 loop inside single transaction avoids multiple connections
  - facility_id guard: throws early if session missing facility_id — defence against misconfigured prison sessions

# Metrics
metrics:
  duration: 3 minutes
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 05 Plan 03: Incoming Deliveries View Summary

getExpectedDeliveries Server Action with prison_role RLS and anti-join exclusion of registered pickups, plus /prison/incoming card grid page showing direct and collapsible consolidated delivery groups.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create getExpectedDeliveries Server Action and prison actions file | 9873b74 | apps/web/app/prison/actions.ts |
| 2 | Build incoming deliveries page with card grid UI | 587384e | apps/web/app/prison/incoming/page.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] outbound_shipments has no reference column**
- **Found during:** Task 1
- **Issue:** Plan specified `outbound_shipment_reference` in the return type and query, but `outbound_shipments` table schema has no `reference` column (confirmed by reading transport.ts)
- **Fix:** Derived display reference as `OS-${id.slice(0, 8).toUpperCase()}` — unique and human-readable fallback; removed the non-existent column from the SELECT
- **Files modified:** apps/web/app/prison/actions.ts
- **Commit:** 9873b74

**2. [Rule 3 - Blocking] HTML `<details>` instead of @base-ui Collapsible**
- **Found during:** Task 2
- **Issue:** Plan suggested "@base-ui Collapsible" as an option, but @base-ui/react Collapsible is not confirmed installed; checked available components — no Collapsible
- **Fix:** Used native HTML `<details>`/`<summary>` element — tablet-compatible, no JS dependency, plan explicitly lists it as an acceptable alternative ("Use HTML `<details>` element (or @base-ui Collapsible)")
- **Files modified:** apps/web/app/prison/incoming/page.tsx
- **Commit:** 587384e

## Known Stubs

None — all data flows are wired. The `/prison/intake/[id]` and `/prison/intake/new` routes do not yet exist (they are built in later Phase 5 plans), so links point to future routes. This is expected and documented in the plan's dependency graph.

## Self-Check: PASSED
