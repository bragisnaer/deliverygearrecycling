---
phase: 05-prison-intake-and-counting
plan: "05"
subsystem: prison-intake
tags: [prison, intake, unexpected-delivery, notifications, client-selection]
dependency_graph:
  requires: ["05-01", "05-02", "05-04"]
  provides: ["unexpected-intake-form", "getClientsForIntake", "getProductsForClient", "submitUnexpectedIntake"]
  affects: ["intake_records", "intake_lines", "notifications"]
tech_stack:
  added: []
  patterns:
    - "raw db for cross-tenant reads (prison role has no tenants/products RLS)"
    - "raw db for notification insert (prison role has no notifications RLS)"
    - "startTransition for async product fetch after client selection"
    - "intakeId as route segment for unexpected success redirect (no pickup_id)"
key_files:
  created:
    - apps/web/app/prison/intake/new/page.tsx
    - apps/web/app/prison/components/unexpected-intake-form.tsx
  modified:
    - apps/web/app/prison/actions.ts
decisions:
  - "getClientsForIntake and getProductsForClient use raw db — prison_role RLS has no policies on tenants or products tables"
  - "submitUnexpectedIntake notification insert uses raw db — prison_role has no notifications INSERT policy"
  - "Success redirect uses intakeId as [id] route segment — unexpected intakes have no pickup_id"
  - "Submit button disabled until client selected and products loaded — prevents empty-line submissions"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-20"
  tasks: 1
  files: 3
---

# Phase 05 Plan 05: Unexpected Delivery Intake Form Summary

Unexpected delivery intake form at /prison/intake/new where prison staff selects a client from a dropdown and enters all details manually; submission creates is_unexpected=true intake record with reco-admin notification.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create unexpected intake form, page, and Server Action | 3b8c22e | apps/web/app/prison/actions.ts, apps/web/app/prison/components/unexpected-intake-form.tsx, apps/web/app/prison/intake/new/page.tsx |

## What Was Built

**Server Actions (apps/web/app/prison/actions.ts):**

- `getClientsForIntake()` — fetches all active tenants via raw db (prison_role has no tenants RLS policy), ordered alphabetically
- `getProductsForClient(tenantId)` — fetches active products for a tenant via raw db (prison_role has no products RLS policy), ordered alphabetically, numeric weight_grams coerced to number
- `submitUnexpectedIntake(formData)` — validates FormData, inserts intake_record with `is_unexpected=true` and `pickup_id=null`, inserts intake_lines with `informed_quantity=null`, notifies reco-admin via raw db with type `unexpected_intake`

**Client Component (unexpected-intake-form.tsx):**

- Step 1: shadcn Select dropdown (base-ui/react/select) to pick the client — triggers async product fetch via `getProductsForClient`
- Skeleton loader (3 animated placeholder rows) while products load
- Step 2: QuantitySpinner per product (no `informedQty` — no expected quantities on unexpected deliveries)
- Batch/lot number input per product line
- Staff name, delivery date (defaults today), origin market, notes fields
- Submit button disabled until client selected and at least one product loaded
- On success: redirects to `/prison/intake/[intakeId]/success?intakeId=[intakeId]`

**Server Page (apps/web/app/prison/intake/new/page.tsx):**

- Fetches clients via `getClientsForIntake()`
- Reads discrepancy threshold from system_settings (default 15)
- Renders page heading from `t('form.unexpected_delivery')` (da.json key)
- Passes `clients` and `threshold` to `UnexpectedIntakeForm`

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Architectural Notes

**RLS pattern consistency:** Both `getClientsForIntake` and `getProductsForClient` use raw `db` (not `withRLSContext`) — same pattern as Phase 4 admin email query. Prison_role has no SELECT policy on tenants or products tables; raw db runs as service role bypassing RLS.

**Notification insert pattern:** `submitUnexpectedIntake` inserts the `unexpected_intake` notification via raw `db` inside a non-blocking try/catch. Prison_role has no INSERT policy on notifications — same pattern as Phase 4 discrepancy notifications workaround.

**Route segment for success:** Unexpected intakes have no `pickup_id`, so the success redirect uses `intakeId` as the `[id]` segment: `/prison/intake/[intakeId]/success?intakeId=[intakeId]`. The success page fetches the intake record directly from `intakeRecords` using `intakeId` from searchParams — this works correctly.

## Known Stubs

None — the form wires to real DB actions and real client/product data.

## Self-Check: PASSED

- [x] `apps/web/app/prison/intake/new/page.tsx` exists
- [x] `apps/web/app/prison/components/unexpected-intake-form.tsx` exists with 'use client'
- [x] `getClientsForIntake` in actions.ts
- [x] `getProductsForClient` in actions.ts
- [x] `submitUnexpectedIntake` in actions.ts
- [x] `is_unexpected: true` in submitUnexpectedIntake
- [x] `unexpected_intake` notification type in submitUnexpectedIntake
- [x] Select/select in unexpected-intake-form.tsx
- [x] QuantitySpinner in unexpected-intake-form.tsx
- [x] pnpm --filter @repo/web test passes (8 passed, 2 skipped)
- [x] Commit 3b8c22e exists
