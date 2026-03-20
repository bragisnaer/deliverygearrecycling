---
phase: 04-pickup-booking-and-transport-management
plan: 04
subsystem: ui
tags: [transport, providers, crud, server-actions, react-hook-form, zod, drizzle, rls]

# Dependency graph
requires:
  - phase: 04-01
    provides: transport schema (transportProviders, transportProviderClients, transportTypeEnum)

provides:
  - Transport provider list page at /transport/providers with linked client counts
  - Transport provider create page at /transport/providers/new with multi-select tenant linking
  - Transport provider detail/edit page at /transport/providers/[id]
  - ProviderForm client component with conditional warehouse address for consolidation type
  - createTransportProvider and updateTransportProvider Server Actions with Zod validation
  - getTransportProviders, getTransportProvider, getAllTenants read actions

affects:
  - 04-05 (transport booking uses provider registry)
  - 04-06 (outbound shipments use provider registry)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server Action CRUD with Zod validation (following products/actions.ts pattern)
    - withRLSContext wrapping all DB reads and writes
    - Form component extracted as client component, page stays server component
    - Conditional field rendering via form.watch() for consolidation warehouse address
    - Multi-select via checkbox list with linked_tenant_ids array in form state

key-files:
  created:
    - apps/web/app/(ops)/transport/providers/actions.ts
    - apps/web/app/(ops)/transport/providers/page.tsx
    - apps/web/app/(ops)/transport/providers/new/page.tsx
    - apps/web/app/(ops)/transport/providers/[id]/page.tsx
    - apps/web/app/(ops)/transport/providers/components/provider-form.tsx
  modified: []

key-decisions:
  - "ProviderForm extracted as client component with form.watch('provider_type') to conditionally render warehouse address field — same pattern as ProductForm"
  - "linked_tenant_ids sent as repeated FormData entries via formData.append() — consistent with pickup lines encoding pattern from 04-03"
  - "updateTransportProvider deletes all existing transportProviderClients then re-inserts — simpler than diff-based update for small tenant counts"
  - "getAllTenants read action uses getSessionClaims() not requireRecoAdmin() — reco role can also view providers and needs tenant list for display"

patterns-established:
  - "Transport provider pages follow identical structure to product pages: list table → new form page → detail/edit page"
  - "Multi-select checkboxes for join table relationships encoded as repeated formData.append() entries"

requirements-completed: [TRANS-01, TRANS-02]

# Metrics
duration: 15min
completed: 2026-03-20
---

# Phase 04 Plan 04: Transport Provider Registry Summary

**Transport provider CRUD with direct/consolidation type, tenant linking via join table, and conditional warehouse address using Server Actions and RLS**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-20T18:10:00Z
- **Completed:** 2026-03-20T18:25:00Z
- **Tasks:** 2
- **Files modified:** 5 created

## Accomplishments

- Full CRUD for transport providers (list, create, edit) following product registry pattern
- Provider type enum (direct/consolidation) with conditional warehouse address field using react-hook-form watch
- Tenant linking via transportProviderClients join table — multi-select checkboxes, replace-on-update strategy
- Zod refine validation ensuring warehouse_address is required when provider_type is consolidation

## Task Commits

1. **Task 1: Create transport provider CRUD Server Actions** - `bf3d2b9` (feat)
2. **Task 2: Create transport provider list, create, and detail pages** - `9f377cc` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/app/(ops)/transport/providers/actions.ts` — CRUD Server Actions: createTransportProvider, updateTransportProvider, getTransportProviders, getTransportProvider, getAllTenants
- `apps/web/app/(ops)/transport/providers/page.tsx` — List page with table showing name, type badge, service regions, platform access, linked client count, status
- `apps/web/app/(ops)/transport/providers/new/page.tsx` — Create page fetching all tenants, rendering ProviderForm in create mode
- `apps/web/app/(ops)/transport/providers/[id]/page.tsx` — Detail/edit page fetching provider by ID with linked tenants
- `apps/web/app/(ops)/transport/providers/components/provider-form.tsx` — Client component with react-hook-form, zod resolver, conditional warehouse address, multi-select tenant checkboxes

## Decisions Made

- `ProviderForm` extracted as client component with `form.watch('provider_type')` to conditionally render warehouse address — same pattern as `ProductForm`
- `linked_tenant_ids` sent as repeated `FormData.append()` entries, matching pickup lines encoding pattern from 04-03
- `updateTransportProvider` deletes all existing `transportProviderClients` then re-inserts — simpler than diff-based update for small tenant counts
- `getAllTenants` uses `getSessionClaims()` not `requireRecoAdmin()` so reco role can also access the tenant list for provider views

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `requireAuth` import path was `@/lib/auth-guard` (not `@/lib/auth-helpers` as initially drafted) — corrected before commit by checking existing pickup pages.

## Known Stubs

None — all form fields wire to real DB actions with RLS context.

## Next Phase Readiness

- Transport provider registry is complete. Plans 04-05 and 04-06 (transport booking and outbound shipments) can now select from the provider registry.
- All tenants are listable for provider-tenant linking.

---
*Phase: 04-pickup-booking-and-transport-management*
*Completed: 2026-03-20*
