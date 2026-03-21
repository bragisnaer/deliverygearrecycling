---
phase: 08
plan: 04
subsystem: ops-dashboard
tags: [dashboard, aggregation, client-switching, financial, prison-pipeline]
dependency_graph:
  requires:
    - 07-02 (financial records schema + getUninvoicedAlerts)
    - 07-03 (UninvoicedAlert component already wired)
    - 06-xx (outbound_dispatches, processing_reports schemas)
    - 05-xx (intake_records schema)
    - 04-xx (pickups, transport schemas)
  provides:
    - Full ops dashboard page at /dashboard
    - getPickupStatusSummary, getConsolidationAgeing, getPrisonPipeline, getRevenueSummary, getDashboardTenants
  affects:
    - apps/web/app/(ops)/dashboard/page.tsx (replaced stub)
tech_stack:
  added: []
  patterns:
    - raw db.execute with sql template tags for cross-tenant reco-admin queries
    - Promise.all parallel server-side data fetching in page.tsx
    - searchParams-driven server-rendered GET form for client filtering (no client JS)
    - display_currency cookie + systemSettings exchange rate read pattern (matching uninvoiced-alert.tsx)
    - (rows as unknown as Type[]) cast for postgres-js RowList compatibility
key_files:
  created:
    - apps/web/app/(ops)/dashboard/actions.ts
    - apps/web/app/(ops)/dashboard/components/client-context-switcher.tsx
    - apps/web/app/(ops)/dashboard/components/pickup-status-summary.tsx
    - apps/web/app/(ops)/dashboard/components/consolidation-ageing-table.tsx
    - apps/web/app/(ops)/dashboard/components/prison-pipeline-card.tsx
    - apps/web/app/(ops)/dashboard/components/revenue-summary-card.tsx
  modified:
    - apps/web/app/(ops)/dashboard/page.tsx
decisions:
  - "raw db (no RLS context) for all dashboard actions — reco-admin cross-tenant queries run as service role, same pattern as getUninvoicedAlerts systemSettings read"
  - "(rows as unknown as Type[]) cast used for postgres-js RowList — db.execute returns RowList which is directly iterable, no .rows property (unlike pg driver)"
  - "updated_at used as arrival_date proxy for at_warehouse pickups — no dedicated arrived_at timestamp on pickups table"
  - "prison pipeline uses LEFT JOIN with CASE COUNT aggregation — avoids N+1 across facilities"
metrics:
  duration_seconds: 265
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_created: 7
  files_modified: 1
---

# Phase 8 Plan 04: Ops Dashboard Summary

**One-liner:** Full ops dashboard replacing stub — 5 data sections (pickup status, consolidation ageing, prison pipeline, revenue, uninvoiced alert) with server-rendered client context switcher via searchParams GET form.

## What Was Built

### Task 1: Dashboard server actions (`actions.ts`)

Five exported async functions, all using raw `db` (no RLS context) for reco-admin cross-tenant access:

- **`getPickupStatusSummary(tenantFilter?)`** — groups pickups by status with CASE ORDER for lifecycle ordering; filters `voided = false`
- **`getConsolidationAgeing(tenantFilter?)`** — joins pickups + tenants for `at_warehouse` pickups, calculates `days_held` via `EXTRACT(EPOCH FROM NOW() - updated_at) / 86400`
- **`getPrisonPipeline(tenantFilter?)`** — LEFT JOINs prison_facilities → intake_records → processing_reports → outbound_dispatches; CASE COUNT aggregation for awaiting/processing/ready/shipped per facility
- **`getRevenueSummary(tenantFilter?)`** — FILTER clause aggregation on financial_records for invoiced/paid/uninvoiced EUR totals
- **`getDashboardTenants()`** — returns active tenants ordered by name for dropdown

### Task 2: Dashboard page + 5 components

- **`page.tsx`** — replaces stub; `force-dynamic`; reads `searchParams.client` for tenant filter; reads `display_currency` cookie + exchange rate; `Promise.all` parallel fetch for all 5 queries; financial sections (`UninvoicedAlert`, `RevenueSummaryCard`) gated by `hasFinancialAccess`
- **`client-context-switcher.tsx`** — native `<form method="GET" action="/dashboard">` with `<select name="client">`; zero client JS; pre-selects active client
- **`pickup-status-summary.tsx`** — responsive badge grid (3→4→5 cols); active statuses (submitted/confirmed/transport_booked/picked_up/in_transit) get left-border accent
- **`consolidation-ageing-table.tsx`** — shadcn Table; days held color-coded green (<7) / amber (7-14) / red (>14); Reference links to `/pickups/{id}`
- **`prison-pipeline-card.tsx`** — shadcn Table; facility rows with awaiting/processing/ready/shipped counts in font-mono
- **`revenue-summary-card.tsx`** — 3-stat grid (Invoiced/Paid/Uninvoiced) with EUR/DKK formatting; record count subtitle

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `db.execute` return type casting**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `db.execute()` with `drizzle-orm/postgres-js` returns a `RowList` (directly iterable array), not an object with a `.rows` property. The plan referenced the `.rows` pattern from `withRLSContext` tx queries (which use a different driver path). TypeScript reported `Property 'rows' does not exist on type 'RowList'`.
- **Fix:** Cast with `(await db.execute(sql`...`)) as unknown as Type[]` — the RowList IS the array, so map directly
- **Files modified:** `apps/web/app/(ops)/dashboard/actions.ts`
- **Commit:** 887595c

## Known Stubs

None — all data sections are wired to live database queries.

## Self-Check: PASSED

All 7 files created/modified confirmed on disk. Both commits verified in git log (887595c, c5ed46d).
