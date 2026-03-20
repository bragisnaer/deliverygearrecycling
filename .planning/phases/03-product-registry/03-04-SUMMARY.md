---
phase: 03-product-registry
plan: 04
subsystem: ui
tags: [react, drizzle, supabase-storage, base-ui, react-hook-form, effective-dates]

requires:
  - phase: 03-01
    provides: storage helpers (getMaterialPhotoPath, getProductsBucket)
  - phase: 03-02
    provides: product_materials and product_pricing schema with effective-date columns
  - phase: 03-03
    provides: actions.ts with getProduct, uploadProductPhoto; product detail page scaffold

provides:
  - getMaterials, createMaterial Server Actions for material library CRUD
  - getCurrentComposition with signed photo URLs, saveMaterialComposition with atomic close+insert
  - uploadMaterialPhoto / deleteMaterialPhoto with array_append/array_remove
  - getPricingHistory, createPricingRecord with effective-date close transaction
  - MaterialCompositionTable component with @base-ui Combobox and inline editing
  - PricingManagement component with current price card and Collapsible history
  - Product detail page wired with live composition and pricing data

affects:
  - phase-07-financials (uses pricing records)
  - phase-08-esg (uses material composition records)

tech-stack:
  added: []
  patterns:
    - "@base-ui/react Combobox for searchable dropdown (replaces shadcn Command — not installed)"
    - "@base-ui/react Collapsible for expand/collapse sections"
    - "Effective-dated close pattern: UPDATE SET effective_to=NOW() then INSERT with effective_to=NULL"
    - "Photo preservation on composition save: map material_library_id -> photo_paths before close"
    - "array_append/array_remove SQL helpers for Postgres array column photo management"

key-files:
  created:
    - apps/web/app/(ops)/products/components/material-composition-table.tsx
    - apps/web/app/(ops)/products/components/pricing-management.tsx
  modified:
    - apps/web/app/(ops)/products/actions.ts
    - apps/web/app/(ops)/products/[id]/page.tsx
    - apps/web/app/(ops)/products/actions.test.ts

key-decisions:
  - "Used @base-ui/react Combobox (not shadcn Command) — cmdk and @radix-ui/react-popover are not installed; @base-ui/react has a first-class Combobox component"
  - "Used @base-ui/react Collapsible for price history expander — native to the codebase UI library"
  - "saveMaterialComposition preserves disassembly_photo_paths across saves by mapping material_library_id before the close UPDATE"
  - "createPricingRecord returns early from within withRLSContext transaction if date validation fails — no insert, no close, no revalidatePath"
  - "Build fails pre-existing due to middleware.ts/proxy.ts conflict — not caused by this plan; tsc --noEmit passes cleanly"

requirements-completed: [PROD-03, PROD-04, PROD-05]

duration: 35min
completed: 2026-03-20
---

# Phase 03 Plan 04: Material Composition and Pricing Summary

**Inline editable material composition table with @base-ui Combobox, disassembly photo management, and effective-dated pricing via atomic close+insert DB transactions**

## Performance

- **Duration:** 35 min
- **Started:** 2026-03-20T16:04:44Z
- **Completed:** 2026-03-20T16:40:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- 8 new Server Actions: getMaterials, createMaterial, getCurrentComposition, saveMaterialComposition, uploadMaterialPhoto, deleteMaterialPhoto, getPricingHistory, createPricingRecord
- Atomic effective-date management: saveMaterialComposition closes all current lines then inserts new ones with photo preservation; createPricingRecord closes previous via (effective_from - 1 day)
- MaterialCompositionTable: useFieldArray rows, @base-ui Combobox for material selection, recycling_outcome dropdown, disassembly photo thumbnails with upload/delete
- PricingManagement: current price card, add-new-price dialog with client-side date validation, Collapsible price history table
- Product detail page updated to call all four data fetchers in parallel and render live components

## Task Commits

1. **Task 1: Material composition and pricing Server Actions** - `1b7bcaa` (feat)
2. **Task 2: Material composition table and pricing management UI** - `6ae2482` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/web/app/(ops)/products/actions.ts` - Added 8 Server Actions for material/pricing CRUD with effective-date management
- `apps/web/app/(ops)/products/actions.test.ts` - Implemented createPricingRecord tests (close logic + date rejection)
- `apps/web/app/(ops)/products/components/material-composition-table.tsx` - New: inline editable table with Combobox, photo strip, save all
- `apps/web/app/(ops)/products/components/pricing-management.tsx` - New: current price card + add form + Collapsible history
- `apps/web/app/(ops)/products/[id]/page.tsx` - Replaced both placeholders with live components

## Decisions Made

- **@base-ui Combobox over shadcn Command:** `cmdk` and `@radix-ui/react-popover` are not in the dependency tree. `@base-ui/react` (already installed) ships a full `Combobox` component with Input, Positioner, Popup, Item, ItemIndicator, and Empty — used directly.
- **@base-ui Collapsible:** Same reasoning — native to the existing UI library, no additional dependencies.
- **Photo preservation pattern:** Before the effective_to close UPDATE, query current lines and build a `Map<material_library_id, photo_paths[]>`. After INSERT, each new line receives the preserved paths where the material_library_id matches. This maintains disassembly photos across composition edits.
- **Transaction return early on validation:** `createPricingRecord` validation check (new date <= current date) returns `{ error }` from inside the `withRLSContext` callback. The transaction naturally rolls back with no changes written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] TypeScript type narrowing for Server Action error returns**
- **Found during:** Task 2 (UI components)
- **Issue:** `result.error` from `saveMaterialComposition` typed as `unknown` (function returns `{success: true}` only), and `result.error` from `createPricingRecord` typed as `string | undefined`
- **Fix:** Wrapped with `String(result.error)` and `result.error ?? 'An error occurred'` respectively
- **Files modified:** material-composition-table.tsx, pricing-management.tsx
- **Verification:** tsc --noEmit exits 0
- **Committed in:** 6ae2482 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - type narrowing)
**Impact on plan:** Minor type-safety fix only. No scope changes.

## Issues Encountered

- Pre-existing build failure: `middleware.ts` and `proxy.ts` both present causes Next.js 16.2 to abort build. Confirmed pre-existing by stash+build before our changes. Out of scope per deviation rules. Logged to deferred items. TypeScript (`tsc --noEmit`) passes cleanly — all new code is type-correct.

## Next Phase Readiness

- Material composition and pricing data layers complete — Phase 7 (financials) can use `productPricing` records and Phase 8 (ESG) can use `productMaterials` with recycling_outcome
- Pre-existing middleware.ts/proxy.ts conflict should be resolved before CI pipeline is added

---
*Phase: 03-product-registry*
*Completed: 2026-03-20*
