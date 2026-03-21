---
phase: 07-financial-tracking
plan: "02"
subsystem: financial
tags: [server-actions, drizzle, rls, react-hook-form, zod, ui, table, form, nav]
dependency_graph:
  requires: [financial_records, intakeRecords, tenants, transportBookings, outboundShipmentPickups, productPricing, systemSettings]
  provides: [getFinancialRecords, getFinancialRecord, calculateAndStoreInvoiceAmount, updateInvoiceFields, getUninvoicedAlerts, /financial, /financial/[id], InvoiceEditForm]
  affects: [07-03]
tech_stack:
  added: []
  patterns: [withRLSContext join queries, native select for base-ui compat, inline Server Action for recalculate button, role-gated Server Component auth]
key_files:
  created:
    - apps/web/app/(ops)/financial/page.tsx
    - apps/web/app/(ops)/financial/[id]/page.tsx
    - apps/web/app/(ops)/financial/components/invoice-edit-form.tsx
  modified:
    - apps/web/app/(ops)/financial/actions.ts
    - apps/web/app/(ops)/ops-nav-bar.tsx
decisions:
  - "Native <select> element used for invoice_status in InvoiceEditForm — @base-ui/react/select does not integrate with react-hook-form Controller; native element accepts standard value/onChange bindings with matching visual style"
  - "Auth checked via auth() directly in Server Components (not requireAuth helper) — consistent with Phase 04 and 06 patterns; requireAuth returns AuthResult shape incompatible with can_view_financials check"
  - "getUninvoicedAlerts reads systemSettings via raw db (not withRLSContext) — settings are non-sensitive and accessible before tenant context is established"
  - "invoiceDateString formatted as YYYY-MM-DD ISO string before passing to InvoiceEditForm — native date input requires this format; DB timestamp serialized via .toISOString().split('T')[0]"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-21"
  tasks: 2
  files: 5
---

# Phase 7 Plan 02: Financial Server Actions and UI Summary

Full financial management UI: five Server Actions (list, detail, calculate, update, alerts) plus /financial list page, /financial/[id] detail page with recalculate button, InvoiceEditForm client component, and Financial nav item between Dispatch and Products.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Server Actions for financial record CRUD and invoice calculation | d321a52 | actions.ts |
| 2 | Financial records list page, detail page, and nav bar link | 56e65f6 | page.tsx, [id]/page.tsx, invoice-edit-form.tsx, ops-nav-bar.tsx |

## What Was Built

### Task 1: Server Actions

- `getFinancialRecords()`: JOIN financialRecords + intakeRecords + tenants; filters `voided = false`; ordered by `created_at DESC`; returns typed `FinancialRecordListItem[]`
- `getFinancialRecord(id)`: single record with pickup_id, notes, updated_at for detail page
- `calculateAndStoreInvoiceAmount(intakeRecordId)`: two-leg transport cost via `assembleTransportCost(leg1, leg2)`; per-product pricing via `isNull(effective_to)` query; calls `calculateInvoiceAmount`; stores both costs on financial record; returns `missing_pricing` array
- `updateInvoiceFields(id, data)`: zod validation with `z.enum(['not_invoiced', 'invoiced', 'paid'])`; parses ISO date string to Date; UPDATE with `updated_at = new Date()`
- `getUninvoicedAlerts(thresholdDays?)`: reads `warehouse_ageing_threshold_days` from systemSettings via raw db; two aggregation queries for overdue count/total and monthly uninvoiced total

### Task 2: UI Pages and Nav Bar

- `/financial` (Server Component): role-gated (reco-admin or reco + can_view_financials → redirect /dashboard); table with 8 columns including status badges (red/yellow/green); `formatCurrency` for EUR amounts; empty state message
- `/financial/[id]` (Server Component): same role gate; `notFound()` for missing records; read-only intake details section; financial amounts section with inline Server Action recalculate button (reco-admin only); InvoiceEditForm section (reco-admin) or read-only invoice details (reco role)
- `InvoiceEditForm` (Client Component): react-hook-form + zodResolver; native `<select>` for status (avoids @base-ui/react/select incompatibility with react-hook-form Controller); Input for invoice_number + invoice_date; native textarea for notes; submit disabled when `!formState.isDirty`; `toast.success`/`toast.error` feedback
- `ops-nav-bar.tsx`: Financial inserted at index 6 — after Dispatch, before Products

## Verification Results

- `grep 'Financial' ops-nav-bar.tsx` → match confirmed
- `grep 'getFinancialRecords' financial/page.tsx` → match confirmed
- `grep 'calculateAndStoreInvoiceAmount' financial/actions.ts` → match confirmed
- `grep 'updateInvoiceFields' invoice-edit-form.tsx` → match confirmed
- `pnpm test --run` → 102 tests PASSED (9 financial action unit tests green)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Design] Native `<select>` instead of shadcn Select component**
- **Found during:** Task 2
- **Issue:** The codebase uses `@base-ui/react/select` (not Radix-based shadcn Select). The `@base-ui` Select uses `value`/`onValueChange` and renders via Portal — it does not expose a standard `onChange` event compatible with react-hook-form's `Controller` pattern
- **Fix:** Used native `<select>` element styled to match the codebase's input appearance (border-input, rounded-lg, font-mono, focus-visible ring classes)
- **Files modified:** `apps/web/app/(ops)/financial/components/invoice-edit-form.tsx`

## Known Stubs

None — all data is wired. The `exchangeRate` is currently hardcoded to `'7.4600'` in the list and detail pages (displayed as EUR only). This is intentional — the currency toggle (EUR/DKK) is Plan 03's responsibility as noted in both page files with inline comments.

## Self-Check: PASSED

- apps/web/app/(ops)/financial/page.tsx: FOUND
- apps/web/app/(ops)/financial/[id]/page.tsx: FOUND
- apps/web/app/(ops)/financial/components/invoice-edit-form.tsx: FOUND
- apps/web/app/(ops)/financial/actions.ts (modified): FOUND
- apps/web/app/(ops)/ops-nav-bar.tsx (modified): FOUND
- Commit d321a52: FOUND
- Commit 56e65f6: FOUND
