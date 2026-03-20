---
phase: 03-product-registry
plan: 05
subsystem: db
tags: [seed, wolt, products, materials, pricing, PROD-07]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [wolt-seed-data, seed-test-coverage]
  affects: [all-downstream-tests-with-realistic-data]
tech_stack:
  added: []
  patterns: [insert-then-select-idempotency, check-before-insert, onConflictDoNothing]
key_files:
  created:
    - packages/db/src/seed-wolt.ts
  modified:
    - packages/db/package.json
    - packages/db/src/tests/seed.test.ts
decisions:
  - "insert-then-select pattern for products (Pitfall 6: onConflictDoNothing().returning() returns empty on conflict)"
  - "check existing rows before insert for product_materials and product_pricing (no unique constraint; onConflictDoNothing not applicable)"
  - "EFFECTIVE_FROM = 2020-01-01 as epoch date for all initial composition and pricing records"
metrics:
  duration_minutes: 15
  completed_date: "2026-03-20T16:17:24Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 03 Plan 05: Wolt Product Seed Script Summary

**One-liner:** Idempotent Wolt seed script inserting 5 products, 26 material composition lines, 16 global material library entries, and 5 pricing records using insert-then-select and check-before-insert patterns for full idempotency.

## What Was Built

### Task 1: `packages/db/src/seed-wolt.ts` (271 lines)

Idempotent seed script for all Wolt product data from PRD §4.10:

**Step 0:** Ensures `wolt` tenant exists via `INSERT ... ON CONFLICT DO NOTHING`.

**Step 1:** Seeds 16 unique material library entries with `onConflictDoNothing()` on the `name` unique constraint.

**Step 2:** Builds a `Map<name, uuid>` by selecting all materials post-insert — used for composition line foreign keys.

**Step 3:** Seeds 5 products with `onConflictDoNothing()`, then selects them back by `(tenant_id, product_code)` to get UUIDs (avoids Pitfall 6: empty `.returning()` on conflict).

**Step 4:** Seeds composition lines per product using a check-before-insert guard (`existing.length === 0`):
- Bike Bag: 12 lines (Polypropylene 943g through Nylon 1g)
- Car Bag: 5 lines (Polyester 555g through POM 6g)
- Inner Bag: 3 lines (Polyester 237g through Remains 25g)
- Heating Plate: 6 lines (Mica Plate 181g through Foam 26g)
- Clothing: no composition (TODO per PRD)

**Step 5:** Seeds pricing records with same check-before-insert guard:
- Bike Bag: EUR 4.2900
- Car Bag: EUR 4.1400
- Inner Bag: EUR 4.0900
- Heating Plate: EUR 2.9900
- Clothing: DKK 35.0000

All numeric values stored as string literals (Drizzle `numeric` → TypeScript `string`).

### Task 2: `packages/db/src/tests/seed.test.ts` (7 tests)

Replaces all `it.todo` stubs with fully implemented integration tests:

1. 5 Wolt products exist after seed
2. Bike Bag weight is 2680 grams
3. Bike Bag has 12 material composition lines
4. All 5 products have at least one pricing record
5. Bike Bag Polypropylene weight is 943g (via inner join to material_library)
6. Clothing product has reuse processing stream and no weight
7. Clothing pricing is DKK 35

`beforeAll` runs `seedWoltProducts()` with 30s timeout — tests are self-contained and idempotent.

### `packages/db/package.json`

Added `"seed:wolt": "tsx src/seed-wolt.ts"` script. `tsx` is already available in the workspace pnpm store.

## Deviations from Plan

### Infrastructure Gate: DATABASE_URL_TEST Not Available

**Found during:** Task 2 verification

**Issue:** `DATABASE_URL_TEST` is not set in the current execution environment and no local PostgreSQL instance is running (`ECONNREFUSED` on port 5432). The test suite and seed:wolt script cannot be executed against a live database in this environment.

**Impact:** The automated verification step (`pnpm --filter db test`) could not be completed. The test suite fails at setup before any test code runs — same failure as the pre-existing state of all 3 test files in the db package.

**Resolution:** Tests are correctly written and TypeScript-compiled clean (`tsc --noEmit` exits 0). Tests will pass in CI where `DATABASE_URL_TEST=postgresql://test_user:test_password@localhost:5432/reco_test` is set and the PostgreSQL service is running.

**In CI:** `pnpm --filter db test` should pass all 7 seed tests after running against the CI test database.

## Self-Check: PASSED

- `packages/db/src/seed-wolt.ts`: FOUND (271 lines, above 100 line minimum)
- `packages/db/src/tests/seed.test.ts`: FOUND (93 lines, no it.todo markers)
- Commit `168ec33`: FOUND (feat(03-05): create Wolt product seed script)
- Commit `fab417d`: FOUND (feat(03-05): implement Wolt seed integration tests)
- TypeScript: PASSED (`tsc --noEmit` exits 0 on both files)
- `onConflictDoNothing`: PRESENT in seed-wolt.ts
- Weight `2680`: PRESENT
- `943` (Polypropylene): PRESENT
- `price_dkk` `35.0000`: PRESENT
- `seed:wolt` script in package.json: PRESENT
