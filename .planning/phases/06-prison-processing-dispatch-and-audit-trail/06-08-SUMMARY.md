---
phase: 06-prison-processing-dispatch-and-audit-trail
plan: "08"
subsystem: dispatch-ui
tags: [dispatch, prison, ops, reco-admin, read-only, packing-list]
dependency_graph:
  requires: ["06-07", "06-05"]
  provides: [prison-dispatch-view, ops-dispatch-crud]
  affects: [prison-home-nav, ops-nav-bar]
tech_stack:
  added: []
  patterns:
    - Server Component with inline Server Actions (status updates)
    - Client component extraction for VoidRecordDialog (VoidDispatchButton)
    - withRLSContext for all prison-role queries (RLS auto-filters to facility)
    - Raw db for product/tenant/facility lookups (no RLS policy on these tables for prison/ops)
key_files:
  created:
    - apps/web/app/prison/dispatch/page.tsx
    - apps/web/app/(ops)/dispatch/page.tsx
    - apps/web/app/(ops)/dispatch/new/page.tsx
    - apps/web/app/(ops)/dispatch/[id]/page.tsx
    - apps/web/app/(ops)/dispatch/[id]/void-dispatch-button.tsx
    - apps/web/app/(ops)/dispatch/components/dispatch-form.tsx
  modified:
    - apps/web/app/prison/actions.ts
    - apps/web/app/prison/page.tsx
    - apps/web/app/(ops)/dispatch/actions.ts
    - apps/web/app/(ops)/ops-nav-bar.tsx
    - apps/web/messages/da.json
decisions:
  - "VoidDispatchButton extracted as separate client component — detail page uses inline Server Actions requiring Server Component; client-side void dialog cannot coexist in same file"
  - "getDispatchList added as separate function from existing getDispatches — joins prisonFacilities and tenants for display names and includes line_count aggregation"
  - "getDispatchHistory uses two-query pattern (dispatches then line counts via inArray) — avoids GROUP BY complexity and matches existing prison actions patterns"
  - "isEdited derived from created_at vs updated_at timestamp comparison (>1s gap) — audit_log table read not needed for simple edited indicator on dispatch detail"
metrics:
  duration_seconds: 468
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 11
---

# Phase 06 Plan 08: Dispatch UI Summary

Dispatch UI for both prison staff (read-only history) and reco-admin (full CRUD: list, create with packing list, detail with status lifecycle).

## What Was Built

### Task 1: Prison dispatch history view (read-only)

Added `getDispatchHistory()` to `apps/web/app/prison/actions.ts` using `withRLSContext` — the prison_role RLS policy on `outbound_dispatches` auto-filters to the current facility's `facility_id` from the JWT claim. The action filters `voided = false`, orders by `dispatch_date DESC`, and fetches line counts via a second `inArray` query.

Created `apps/web/app/prison/dispatch/page.tsx` as a Server Component rendering a table of dispatches with: dispatch date (Danish locale), destination, carrier, status badge (colour-coded), line count. No create button — prison staff have read-only access per DISPATCH-04.

Updated `apps/web/app/prison/page.tsx` to add a third navigation link "Forsendelseshistorik" pointing to `/prison/dispatch`.

Added `dispatch` namespace to `apps/web/messages/da.json` with all required Danish labels.

### Task 2: Ops dispatch pages — list, create form, detail with packing list

Extended `apps/web/app/(ops)/dispatch/actions.ts` with:
- `voidDispatch(id, reason)` — sets voided=true with void_reason, reco-admin only
- `getDispatchDetail(id)` — fetches dispatch + packing list lines with product names (raw db for products)
- `getDispatchList()` — joins prisonFacilities and tenants for display names, includes line_count aggregation
- `getDispatchFormData()` — fetches facilities, tenants, products for the create form
- Added `prisonFacilities`, `tenants`, `products`, `count`, `desc`, `inArray` to imports

Created ops dispatch pages:
- `apps/web/app/(ops)/dispatch/page.tsx` — list with status badge colours (yellow/blue/green), "Create Dispatch" button
- `apps/web/app/(ops)/dispatch/components/dispatch-form.tsx` — Client Component with facility, client, date, destination, carrier, notes fields plus dynamic packing list rows (product dropdown, size bucket for clothing, SKU code text, quantity). Add/remove line buttons. On submit calls `createDispatch` Server Action, redirects to `/dispatch` with toast.
- `apps/web/app/(ops)/dispatch/new/page.tsx` — Server Component wrapper fetching form data
- `apps/web/app/(ops)/dispatch/[id]/page.tsx` — Server Component with dispatch detail, packing list table (Product, Size, SKU Code, Quantity), inline Server Action forms for Mark Picked Up / Mark Delivered buttons, EditedIndicator
- `apps/web/app/(ops)/dispatch/[id]/void-dispatch-button.tsx` — Client Component wrapping VoidRecordDialog

Updated `apps/web/app/(ops)/ops-nav-bar.tsx` to add "Dispatch" nav link at `/dispatch`.

## Deviations from Plan

### Auto-added Missing Functions (Rule 2)

**1. [Rule 2 - Missing] Added `voidDispatch` server action**
- Found during: Task 2
- Issue: Plan specifies detail page includes VoidRecordDialog but no `voidDispatch` action existed in dispatch/actions.ts (Plan 07 only built `createDispatch`, `updateDispatchStatus`, `getDispatches`)
- Fix: Added `voidDispatch(id, reason)` to dispatch/actions.ts with reco-admin auth guard
- Files modified: apps/web/app/(ops)/dispatch/actions.ts

**2. [Rule 2 - Missing] Added `getDispatchList`, `getDispatchDetail`, `getDispatchFormData`**
- Found during: Task 2
- Issue: List page needs facility/tenant names and line counts; detail page needs packing list lines with product names; create form needs dropdown data — none of these were provided by Plan 07's `getDispatches`
- Fix: Added three new query functions to actions.ts

**3. [Rule 1 - Pattern] Extracted VoidDispatchButton as separate client file**
- Found during: Task 2
- Issue: Detail page uses inline Server Actions (requires Server Component) but plan called for VoidRecordDialog (requires client interactivity). Cannot mix `'use server'` inline actions and `'use client'` in one file.
- Fix: Extracted `VoidDispatchButton` to `[id]/void-dispatch-button.tsx` matching the `CancelPickupDialog` pattern in pickup detail page

## Known Stubs

None. All data is wired: `getDispatchHistory` queries live `outbound_dispatches` via RLS, `getDispatchList` joins facility/tenant names, `getDispatchDetail` fetches real packing list lines with product names.

## Self-Check: PASSED

All 11 key files exist on disk. Task commits verified:
- `2f117cf` — feat(06-08): prison dispatch history view (read-only)
- `eed40c4` — feat(06-08): ops dispatch list, create form, detail, nav
