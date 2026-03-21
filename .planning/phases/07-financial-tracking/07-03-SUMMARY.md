---
phase: 07-financial-tracking
plan: "03"
subsystem: financial
tags: [server-component, client-component, cookies, currency-toggle, alert-widget, dashboard]
dependency_graph:
  requires: [getUninvoicedAlerts, formatCurrency, setCurrencyPreference, systemSettings, financial_records]
  provides: [UninvoicedAlert, CurrencyToggle, setCurrencyPreference, display_currency cookie]
  affects: []
tech_stack:
  added: []
  patterns: [async Server Component with cookie read, Client Component with Server Action + router.refresh, raw db for non-sensitive settings, role-gated conditional render]
key_files:
  created:
    - apps/web/app/(ops)/financial/components/uninvoiced-alert.tsx
    - apps/web/app/(ops)/financial/components/currency-toggle.tsx
  modified:
    - apps/web/app/(ops)/financial/actions.ts
    - apps/web/app/(ops)/dashboard/page.tsx
    - apps/web/app/(ops)/financial/page.tsx
decisions:
  - "UninvoicedAlert reads display_currency cookie directly in Server Component — avoids prop drilling through dashboard; same pattern as intake page systemSettings"
  - "CurrencyToggle calls setCurrencyPreference Server Action then router.refresh() — triggers Server Component re-render with new cookie value without full page reload"
  - "setCurrencyPreference uses dynamic import for next/headers cookies() — required pattern for calling cookies() inside a 'use server' action file"
  - "hasFinancialAccess check in dashboard uses role === 'reco-admin' || (role === 'reco' && can_view_financials === true) — matches auth guard pattern from Plan 02"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-21"
  tasks: 2
  files: 5
---

# Phase 7 Plan 03: Uninvoiced Alert Widget and Currency Toggle Summary

UninvoicedAlert Server Component and CurrencyToggle Client Component: overdue delivery alert on ops dashboard (role-gated), EUR/DKK display toggle with cookie persistence on financial records page.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Uninvoiced alert widget and currency toggle components | a196515 | uninvoiced-alert.tsx, currency-toggle.tsx, actions.ts |
| 2 | Wire uninvoiced alert into ops dashboard and currency toggle into financial pages | 14c5760 | dashboard/page.tsx, financial/page.tsx |

## What Was Built

### Task 1: Components and Server Action

- `UninvoicedAlert` (Server Component): reads `display_currency` cookie, fetches exchange rate from `systemSettings` via raw db, calls `getUninvoicedAlerts()`, renders red alert card with overdue count, overdue total, monthly uninvoiced total in chosen currency, and link to `/financial?status=not_invoiced`; returns null when `overdue_count === 0`
- `CurrencyToggle` (Client Component): `'use client'` with `useRouter`; two buttons (EUR / DKK) with active state (bg-foreground/text-background); calls `setCurrencyPreference` Server Action then `router.refresh()` to re-render Server Components
- `setCurrencyPreference` Server Action added to `actions.ts`: sets `display_currency` cookie with 1-year maxAge, path `/`, sameSite `lax`

### Task 2: Wiring

- `dashboard/page.tsx`: imports `UninvoicedAlert`, computes `hasFinancialAccess` (reco-admin or reco+can_view_financials), renders `{hasFinancialAccess && <UninvoicedAlert />}` at top of page above existing welcome content
- `financial/page.tsx`: reads `display_currency` cookie and `exchange_rate_eur_dkk` from systemSettings at page level; passes `currency` and `exchangeRate` to all `formatCurrency()` calls for Transport Cost and Estimated Amount columns; renders `<CurrencyToggle currentCurrency={currency} />` in page header area

## Verification Results

- `grep 'UninvoicedAlert' dashboard/page.tsx` → match (import + conditional render)
- `grep 'CurrencyToggle' financial/page.tsx` → match (import + render)
- `grep 'display_currency' financial/page.tsx` → match (cookie read)
- `grep 'display_currency' currency-toggle.tsx` → match (comment documents cookie name)
- `grep 'setCurrencyPreference' actions.ts` → match
- `grep 'exchange_rate_eur_dkk' financial/page.tsx` → match

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is fully wired. UninvoicedAlert fetches live data from `getUninvoicedAlerts()`. Currency toggle persists via cookie and applies system exchange rate at display time.

## Self-Check: PASSED

- apps/web/app/(ops)/financial/components/uninvoiced-alert.tsx: FOUND
- apps/web/app/(ops)/financial/components/currency-toggle.tsx: FOUND
- apps/web/app/(ops)/financial/actions.ts (setCurrencyPreference added): FOUND
- apps/web/app/(ops)/dashboard/page.tsx (UninvoicedAlert wired): FOUND
- apps/web/app/(ops)/financial/page.tsx (CurrencyToggle + currency wired): FOUND
- Commit a196515: FOUND
- Commit 14c5760: FOUND
