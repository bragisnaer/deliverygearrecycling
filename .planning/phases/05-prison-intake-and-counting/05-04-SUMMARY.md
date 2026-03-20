---
phase: 05-prison-intake-and-counting
plan: "04"
subsystem: prison-intake
tags: [prison, intake, form, discrepancy, server-action]
dependency_graph:
  requires: ["05-01", "05-02", "05-03"]
  provides: ["intake-form-ui", "submit-intake-action", "expected-delivery-detail"]
  affects: ["05-05", "05-06"]
tech_stack:
  added: []
  patterns:
    - "QuantitySpinner with live discrepancy badge via calculateDiscrepancyPct"
    - "IntakeForm Client Component with state-driven FormData construction"
    - "submitIntake server action with zod validation, RLS transaction, notification"
    - "AutoRedirect client component with useEffect + clearTimeout cleanup (Pitfall 7)"
    - "Server page reads systemSettings for threshold via raw db (no RLS needed)"
key_files:
  created:
    - apps/web/app/prison/components/quantity-spinner.tsx
    - apps/web/app/prison/components/intake-form.tsx
    - apps/web/app/prison/intake/[id]/page.tsx
    - apps/web/app/prison/intake/[id]/success/page.tsx
    - apps/web/app/prison/intake/[id]/success/auto-redirect.tsx
  modified:
    - apps/web/app/prison/actions.ts
decisions:
  - "AutoRedirect uses useRef for timeout handle — prevents stale closure capturing old id, and clears on unmount to prevent double-navigation"
  - "systemSettings read via raw db (not withRLSContext) in intake page — same pattern as admin email query in Phase 4; settings are non-sensitive and reco-admin RLS would block prison role"
  - "ExpectedDeliveryDetail type declared in actions.ts and re-exported from intake-form.tsx to avoid circular imports between page and component"
  - "Success page fetches intake record via raw db (not withRLSContext) to avoid prison RLS complexity when reading by intakeId from URL param"
metrics:
  duration: "3m 21s"
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 6
---

# Phase 05 Plan 04: Intake Form and Success Screen Summary

One-liner: Expected delivery intake form with QuantitySpinner, live discrepancy detection, submitIntake server action with RLS transaction, and 10-second auto-dismiss success screen.

## What Was Built

### Task 1: QuantitySpinner, IntakeForm, and server actions

**`apps/web/app/prison/components/quantity-spinner.tsx`**

A Client Component rendering a product counting row with:
- Minus/Plus buttons at 44×44px minimum touch targets
- Centered Input with numeric-only handling and integer-on-blur validation
- aria-label on both buttons (Reducer antal / Forog antal) and aria-live="polite" on the input
- "Forventet: N" helper text when informedQty is provided
- Amber highlight (border-amber-200 bg-amber-50) and Badge ("±N fra forventet") when calculateDiscrepancyPct exceeds threshold

**`apps/web/app/prison/components/intake-form.tsx`**

A Client Component with:
- useState-driven form state for staff_name, delivery_date, origin_market, notes, and per-line actual_quantity + batch_lot_number
- Lines pre-populated from pickup.lines with actual_quantity defaulting to informed_quantity
- Live discrepancy summary banner (amber, non-blocking) visible above submit when any line exceeds threshold
- FormData construction + submitIntake call via useTransition
- Redirect to /prison/intake/[id]/success?intakeId=... on success
- Toast error on failure

**`apps/web/app/prison/actions.ts` additions:**
- `getExpectedDelivery(pickupId)`: fetches single pickup with tenant join and product lines; returns ExpectedDeliveryDetail or null
- `submitIntake(formData)`: parses indexed FormData lines, validates with zod, reads discrepancy threshold from system_settings (raw db, default 15), calculates discrepancy_pct per line, inserts intake_record + intake_lines in a single withRLSContext transaction, updates pickup status to 'intake_registered', and inserts a 'discrepancy_detected' notification for reco-admin if any line exceeds threshold (non-blocking try/catch)

### Task 2: Intake form page and success screen

**`apps/web/app/prison/intake/[id]/page.tsx`**

Server Component that:
- Calls getExpectedDelivery(params.id)
- Shows a "not found" error with back link if pickup not found
- Reads threshold from system_settings via raw db
- Renders IntakeForm with pickup data and threshold

**`apps/web/app/prison/intake/[id]/success/page.tsx`**

Server Component that:
- Accepts intakeId from search params
- Fetches intake_record + intake_lines via raw db
- Shows title (Levering Registreret), reference, origin market, and per-product counted quantities
- Renders AutoRedirect and two navigation buttons

**`apps/web/app/prison/intake/[id]/success/auto-redirect.tsx`**

Client Component that:
- Sets a 10-second setTimeout and 1-second setInterval for countdown display
- Stores timeout handle in useRef
- Clears both timeout and interval in useEffect cleanup — prevents double-navigation if user taps a button before timer fires (Pitfall 7)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

## Known Stubs

None — all data is wired to real DB queries. The success screen fetches live intake_record data by intakeId from search params.

## Self-Check: PASSED

Files exist:
- apps/web/app/prison/components/quantity-spinner.tsx — FOUND
- apps/web/app/prison/components/intake-form.tsx — FOUND
- apps/web/app/prison/intake/[id]/page.tsx — FOUND
- apps/web/app/prison/intake/[id]/success/page.tsx — FOUND
- apps/web/app/prison/intake/[id]/success/auto-redirect.tsx — FOUND

Commits:
- b102805 — feat(05-04): QuantitySpinner, IntakeForm components, and intake server actions
- dc6247a — feat(05-04): intake form page and success screen
