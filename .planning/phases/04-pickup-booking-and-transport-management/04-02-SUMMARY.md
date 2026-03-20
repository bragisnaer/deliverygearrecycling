---
phase: 04-pickup-booking-and-transport-management
plan: "02"
subsystem: client-pickup-booking
tags:
  - server-action
  - form
  - validation
  - tdd
  - client-portal
dependency_graph:
  requires:
    - "04-01"  # pickups schema, locations schema, DB trigger for PU-YYYY-NNNN reference
  provides:
    - submitPickupRequest Server Action
    - pickup booking form page (client)
    - 72h lead time validation (server + client)
    - auto-calculated estimated weight
  affects:
    - apps/web/app/(client)/pickups/*
tech_stack:
  added: []
  patterns:
    - withRLSContext for all DB access (insert pickups, pickup_lines; select locations, products)
    - FormData-based Server Action following existing products/actions.ts pattern
    - TDD: test file committed first (RED), then implementation (GREEN)
    - Server Component page fetches data; 'use client' PickupBookingForm handles interaction
    - react-hook-form + zod resolver for client-side validation
    - sonner toast for success/error feedback
key_files:
  created:
    - apps/web/app/(client)/pickups/actions.ts
    - apps/web/app/(client)/pickups/actions.test.ts
    - apps/web/app/(client)/pickups/new/page.tsx
    - apps/web/app/(client)/pickups/new/pickup-booking-form.tsx
  modified: []
decisions:
  - "Lines encoded in FormData as lines[0][product_id] / lines[0][quantity] — matches pattern parseable without JSON body; parseFormDataToInput() extracts indexed entries"
  - "PickupBookingForm extracted as separate Client Component — keeps page.tsx a pure Server Component for data fetching while form interactivity stays client-side"
  - "Photo files attached to FormData but not yet uploaded to storage — a placeholder; actual Supabase Storage upload can be added in a follow-up plan"
metrics:
  duration_seconds: 236
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 04 Plan 02: Pickup Booking Form and Server Action Summary

**One-liner:** Client pickup booking form with FormData Server Action using withRLSContext inserts, 72h lead-time enforcement, and auto-calculated estimated weight from product registry.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 (RED) | Failing tests for submitPickupRequest | a2a9dc4 | actions.test.ts |
| 1 (GREEN) | submitPickupRequest Server Action | a9aecf7 | actions.ts |
| 2 | Pickup booking form page | 62ca276 | new/page.tsx, new/pickup-booking-form.tsx |

## What Was Built

### submitPickupRequest Server Action (`actions.ts`)

- `'use server'` directive; `requireClient()` enforces `client` or `client-global` role via next-auth session
- `pickupFormSchema` with Zod: `preferred_date` (transformed to Date), `pallet_count` (int ≥ 1), `pallet_dimensions` (optional), `notes` (optional), `lines[]` (product_id + quantity)
- `parseFormDataToInput()` extracts `lines[N][field]` indexed FormData entries
- 72-hour lead time check: `preferred_date < now + 72h → { error: '...' }`
- Empty quantities guard: filters `quantity > 0`; if none → `{ error: '...' }`
- Weight calculation: `SUM(parseFloat(product.weight_grams) * quantity) + (pallet_count * 25000)`
- 5 separate `withRLSContext` calls: fetch location → fetch products → insert pickup → insert pickup_lines → select reference
- Returns `{ success: true, reference: 'PU-YYYY-NNNN', pickupId }`

### Unit Tests (`actions.test.ts`, TDD)

Four tests covering all behavior:
1. 72h rejection (48h date → error)
2. 72h acceptance (96h date → no error)
3. Empty quantities rejection
4. Weight calculation correctness: 500×5 + 300×3 + 2×25000 = 53400

All 19 project tests pass.

### Pickup Booking Form Page (`new/page.tsx` + `new/pickup-booking-form.tsx`)

- **Server Component** (`page.tsx`): calls `requireAuth(['client', 'client-global'])`, fetches location via `withRLSContext`, fetches active products for tenant
- **Location display**: read-only block (name, address, country) per PICKUP-03 decision — no editable input
- **`PickupBookingForm` Client Component**: react-hook-form with zod resolver, sonner toasts, `useRouter` for redirect
- **Product quantity table**: scrollable, one row per active product with columns: Name, Code, Weight (g), Quantity (number input)
- **Estimated weight**: auto-calculated from `useWatch` values; updates reactively; displayed in kg with 2dp
- **Pallet fields**: pallet_count (number, min 1), pallet_dimensions (text, optional)
- **Date picker**: `<input type="date" min={getMin72hDate()}>` — blocks all dates within 72h
- **Notes**: textarea, optional
- **Photo upload**: drag-and-drop zone + hidden file input, `accept="image/*"`, up to 5 files with preview list and individual remove

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Notes

**Photo storage not yet wired:** Photos are collected in state and appended to FormData but not uploaded to Supabase Storage. The Server Action does not process photo files yet. This is intentional — the plan specifies "consistent with product photo upload pattern" but does not assign a storage action to this plan. A follow-up plan can add `uploadPickupPhoto` following the `uploadProductPhoto` pattern in `(ops)/products/actions.ts`.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `new/pickup-booking-form.tsx` | ~155 | Photos appended to FormData but not uploaded | Storage upload action not in scope for this plan — photos collected but `submitPickupRequest` ignores them; future plan wires Supabase Storage |

## Self-Check: PASSED

All created files exist on disk. All task commits verified in git log.
