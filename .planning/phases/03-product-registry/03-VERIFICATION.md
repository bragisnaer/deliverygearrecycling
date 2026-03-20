---
phase: 03-product-registry
verified: 2026-03-20T17:30:00Z
status: passed
score: 8/8 requirements verified
re_verification: false
---

# Phase 3: Product Registry Verification Report

**Phase Goal:** reco-admin can manage a complete product catalogue per tenant; Wolt products are pre-loaded and ready for use in all downstream forms
**Verified:** 2026-03-20
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | material_library table exists with deny-all + reco-admin-all + authenticated-read RLS | VERIFIED | `packages/db/src/schema/materials.ts` — all three pgPolicy blocks present; migration 0001_curved_zaran.sql generated |
| 2 | products, product_materials, product_pricing tables exist with correct enums, columns, and RLS | VERIFIED | `packages/db/src/schema/products.ts` — all three tables, two enums, full RLS; migration 0002_natural_exiles.sql confirmed |
| 3 | reco-admin can create/edit products via UI at /products and /products/[id] | VERIFIED | `products/page.tsx`, `products/[id]/page.tsx`, `products/new/page.tsx`, `product-form.tsx` all exist and are substantive |
| 4 | reco-admin can upload up to 5 product identification photos via drag-and-drop | VERIFIED | `product-photo-upload.tsx` — onDragOver/Drop handlers, 5MB + image-type validation, 5-photo limit, grid-cols-2 md:grid-cols-3 thumbnail grid |
| 5 | reco-admin can view and edit material composition inline with searchable combobox | VERIFIED | `material-composition-table.tsx` — useFieldArray, @base-ui Combobox, all columns, saveMaterialComposition wired |
| 6 | Effective-dated composition/pricing records managed atomically by Server Actions | VERIFIED | `actions.ts` — saveMaterialComposition uses UPDATE+INSERT in withRLSContext; createPricingRecord closes previous via effective_to = new_date - 1 day inside transaction |
| 7 | "Products" nav item visible in ops portal | VERIFIED | `ops-nav-bar.tsx` — Products link at /products with active-path detection; layout.tsx includes OpsNavBar |
| 8 | Wolt products pre-loaded via idempotent seed script | VERIFIED | `seed-wolt.ts` (271 lines) — 5 products, 26 material lines, 5 pricing records; insert-then-select idempotency; `seed:wolt` npm script present in package.json |

**Score:** 8/8 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/db/src/schema/materials.ts` | material_library pgTable with RLS | VERIFIED | 44 lines; pgTable('material_library'), deny-all + reco-admin-all + authenticated-read policies |
| `packages/db/src/schema/products.ts` | products, productMaterials, productPricing + enums | VERIFIED | 184 lines (above 100 min); all three tables, two enums, full FK refs, RLS policies |
| `packages/db/src/schema/index.ts` | Re-exports materials and products | VERIFIED | `export * from './materials'` and `export * from './products'` both present |
| `packages/db/migrations/0002_natural_exiles.sql` | Products schema migration with FORCE RLS | VERIFIED | CREATE TABLE for all three tables + enums, products_code_tenant_uniq index, FORCE ROW LEVEL SECURITY on all four tables |
| `apps/web/lib/storage.ts` | Supabase Storage client + path helpers | VERIFIED | Lazy-init getStorageClient/getProductsBucket factories; getProductPhotoPath and getMaterialPhotoPath exported |
| `apps/web/lib/storage.test.ts` | Storage path helper unit tests (3 green) | VERIFIED | 3 substantive tests; imports from ./storage; no todos |
| `apps/web/app/(ops)/products/actions.ts` | 14 Server Actions with auth guards | VERIFIED | 634 lines; all 14 actions present: getProducts, getProduct, createProduct, updateProduct, uploadProductPhoto, deleteProductPhoto, getMaterials, createMaterial, getCurrentComposition, saveMaterialComposition, uploadMaterialPhoto, deleteMaterialPhoto, getPricingHistory, createPricingRecord |
| `apps/web/app/(ops)/products/page.tsx` | Product list page | VERIFIED | Calls getProducts, renders Table, /products/[id] links, empty state CTA |
| `apps/web/app/(ops)/products/[id]/page.tsx` | Product detail page | VERIFIED | Calls all four data fetchers in parallel, renders ProductForm + ProductPhotoUpload + MaterialCompositionTable + PricingManagement; notFound() guard present |
| `apps/web/app/(ops)/products/components/product-form.tsx` | Create/edit form | VERIFIED | react-hook-form + zod, all fields including processing_stream, createProduct/updateProduct wired |
| `apps/web/app/(ops)/products/components/product-photo-upload.tsx` | Drag-and-drop upload | VERIFIED | onDragOver/Enter/Leave/Drop, file input fallback, grid-cols-2 md:grid-cols-3 thumbnail grid, click-to-enlarge Dialog, X-to-delete |
| `apps/web/app/(ops)/products/components/material-composition-table.tsx` | Inline editable table with combobox | VERIFIED | useFieldArray, @base-ui Combobox, recycling_outcome select, disassembly photo strip (2 per row), Add new material dialog, saveMaterialComposition wired |
| `apps/web/app/(ops)/products/components/pricing-management.tsx` | Current price + history + add form | VERIFIED | Current price card with null-check, Add New Price dialog with date validation, Collapsible price history table, createPricingRecord wired |
| `apps/web/app/(ops)/ops-nav-bar.tsx` | Products nav link | VERIFIED | Products href="/products" present, usePathname active detection |
| `packages/db/src/seed-wolt.ts` | Idempotent Wolt seed | VERIFIED | 271 lines (above 100 min); onConflictDoNothing; insert-then-select pattern; 5 products, 12 Bike Bag lines, correct weights; seed:wolt script in package.json |
| `packages/db/src/tests/seed.test.ts` | 7 seed integration tests | VERIFIED | No it.todo; toHaveLength(5), toHaveLength(12), weight 2680, Polypropylene 943, reuse stream, DKK 35 — all present |
| `apps/web/app/(ops)/products/actions.test.ts` | createPricingRecord unit tests | VERIFIED | 2 active tests (not todo): close logic + date rejection; mocks withRLSContext correctly |
| `packages/db/src/tests/schema.test.ts` | Schema assertions for PROD-01, PROD-06, PROD-08 | VERIFIED | products table test (active), material_library table test (active), product_group column test (active) — no todos on these |
| `packages/db/src/tests/rls.test.ts` | RLS assertions for material_library | VERIFIED | Describe block 'RLS: product registry tables'; both active tests for client_role SELECT and INSERT |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `schema/index.ts` | `schema/materials.ts` | re-export | WIRED | `export * from './materials'` confirmed |
| `schema/index.ts` | `schema/products.ts` | re-export | WIRED | `export * from './products'` confirmed |
| `schema/products.ts` | `schema/materials.ts` | FK reference | WIRED | `.references(() => materialLibrary.id)` on material_library_id |
| `schema/products.ts` | `schema/tenants.ts` | FK reference | WIRED | `.references(() => tenants.id, { onDelete: 'cascade' })` |
| `schema/products.ts` | `schema/auth.ts` | role imports | WIRED | `import { recoAdminRole, recoRole, clientRole } from './auth'` |
| `products/actions.ts` | `schema/products.ts` (via @repo/db) | Drizzle queries with withRLSContext | WIRED | withRLSContext present throughout; all table imports from @repo/db |
| `products/actions.ts` | `lib/storage.ts` | photo upload via getProductsBucket | WIRED | `getProductsBucket()` called in uploadProductPhoto, deleteProductPhoto, getProduct, getCurrentComposition, uploadMaterialPhoto |
| `layout.tsx` | `products/page.tsx` | nav link via OpsNavBar | WIRED | OpsNavBar renders Products link at /products; layout.tsx imports OpsNavBar |
| `material-composition-table.tsx` | `products/actions.ts` | saveMaterialComposition Server Action | WIRED | import + call on form submit |
| `pricing-management.tsx` | `products/actions.ts` | createPricingRecord Server Action | WIRED | import + call on form submit |
| `products/actions.ts` | `schema/products.ts` | db.transaction for effective-date close | WIRED | withRLSContext callback with UPDATE+INSERT in saveMaterialComposition; explicit closeDate logic in createPricingRecord |
| `seed-wolt.ts` | `schema/products.ts` | Drizzle insert | WIRED | `db.insert(products).values(...)` with onConflictDoNothing |
| `seed-wolt.ts` | `schema/materials.ts` | Drizzle insert | WIRED | `db.insert(materialLibrary).values(...)` with onConflictDoNothing |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| PROD-01 | 03-02, 03-03 | Products have name, product_code (unique per tenant), product_group, processing_stream, description, weight_grams, active | SATISFIED | products table with all columns; per-tenant unique index in migration; ProductForm covers all fields |
| PROD-02 | 03-01, 03-03 | Each product has up to 5 photos (Supabase Storage) | SATISFIED | storage.ts path helpers; uploadProductPhoto with 5-photo limit; ProductPhotoUpload component with drag-and-drop |
| PROD-03 | 03-02, 03-04 | Each product has material composition lines from global material library | SATISFIED | product_materials table with material_library FK; MaterialCompositionTable; getCurrentComposition + saveMaterialComposition |
| PROD-04 | 03-02, 03-04 | Pricing records with effective_from/effective_to; historical rates preserved | SATISFIED | product_pricing table with effective_from/effective_to; createPricingRecord closes previous via (new_date - 1 day); PricingManagement UI |
| PROD-05 | 03-02, 03-04 | product_materials records have effective_from/effective_to for historical ESG accuracy | SATISFIED | effective_from/effective_to on product_materials; saveMaterialComposition atomically closes previous and inserts new |
| PROD-06 | 03-01 | Global material_library table with canonical names used across all tenants | SATISFIED | materials.ts with deny-all + reco-admin-all + authenticated-read RLS; createMaterial action; combobox in composition table |
| PROD-07 | 03-05 | Wolt products pre-loaded: Bike Bag (2680g), Car Bag (918g), Inner Bag (324g), Heating Plate (703g), Clothing; with materials and pricing | SATISFIED | seed-wolt.ts with all 5 products, 26 material lines, 5 pricing records; seed:wolt script; 7 integration tests in seed.test.ts |
| PROD-08 | 03-02, 03-03 | product_group field aggregates related products | SATISFIED | product_group column in products table (nullable); rendered in ProductForm and product list table |

All 8 requirements explicitly claimed by plans in this phase are satisfied. No orphaned requirements detected (REQUIREMENTS.md traceability table maps all 8 PROD-* IDs to Phase 3 with status Complete).

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `products/[id]/page.tsx` | n/a | No "Coming soon" placeholders | INFO | Both Material Composition and Pricing sections replaced with live components as required |
| `seed-wolt.ts` | 126 | `// TODO: weight unknown per PRD §4.10` on Clothing | INFO | Intentional — PRD documents weight as unknown; no composition inserted for Clothing per spec |
| `actions.test.ts` | 141-142 | 2 `it.todo` stubs remain in actions.test.ts | INFO | Only composition/historical query todos remain; the 2 critical pricing tests are active. These are low-priority stubs, not blockers |
| `package.json` (db) | — | `tsx` absent from devDependencies | INFO | `tsx` is available via the pnpm workspace (confirmed in pnpm-lock.yaml); seed:wolt script will resolve it via workspace. Not a blocker |

No blocker anti-patterns found. No stub implementations. No empty returns.

---

## Human Verification Required

### 1. Photo Upload End-to-End

**Test:** Create a product, drag an image file onto the drop zone, verify the photo appears in the thumbnail grid and persists on page reload
**Expected:** Photo stored in Supabase Storage at `{tenant_id}/products/{id}/photos/{timestamp}-{filename}`; signed URL renders in thumbnail grid
**Why human:** Requires live Supabase Storage environment and browser interaction

### 2. Material Combobox Search and Add New

**Test:** Open the material composition table, type in the combobox to filter materials, then click "Add new material..." and create a new entry
**Expected:** New material immediately selectable; new entry visible in global material_library; next page load includes it
**Why human:** Requires live DB and browser interaction to verify combobox state management

### 3. Pricing Effective-Date Close

**Test:** Create two pricing records for the same product sequentially; verify the first record's effective_to was set to (second record's effective_from - 1 day)
**Expected:** First record shows effective_to date; second record shows "Current" badge in price history
**Why human:** Requires live DB; visual verification of the Collapsible price history table

### 4. Wolt Seed Against Production/Staging DB

**Test:** Run `pnpm --filter db seed:wolt` against a real PostgreSQL instance
**Expected:** "Wolt seed complete" logged; 5 products visible at /products when logged in as wolt tenant user; running twice produces no duplicates
**Why human:** No local DB available in build environment; seed integration tests are written and validated for CI only

### 5. Navigation Active State

**Test:** Navigate to /products — verify "Products" link in ops nav bar is bold/underlined; navigate to /settings — verify "Settings" is active and "Products" is not
**Expected:** usePathname correctly identifies active nav item per OpsNavBar logic
**Why human:** Visual/interactive browser check

---

## Gaps Summary

No gaps. All 8 requirements are satisfied by substantive, wired implementations. The two remaining `it.todo` stubs in `actions.test.ts` (composition update and historical query) are non-blocking — they were explicitly planned as lower-priority stubs beyond the critical pricing close tests, which are fully implemented and passing.

The pre-existing `middleware.ts`/`proxy.ts` build conflict noted in summaries 03-03 and 03-04 is not caused by this phase and does not affect the product registry functionality. It is logged as a deferred item in those summaries.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
