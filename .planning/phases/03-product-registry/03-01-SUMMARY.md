---
phase: 03-product-registry
plan: 01
subsystem: db-schema, storage
tags: [material-library, rls, supabase-storage, test-stubs, wave-0]
dependency_graph:
  requires: []
  provides:
    - material_library pgTable with RLS
    - @supabase/storage-js path helpers
    - Wave 0 test stubs for PROD-01 through PROD-08
  affects:
    - packages/db/src/schema/index.ts
    - All future product registry plans (03-02+)
tech_stack:
  added:
    - "@supabase/storage-js@^2.99.3 (apps/web)"
  patterns:
    - Drizzle pgPolicy with restrictive deny-all + permissive role policies
    - Lazy-init StorageClient to allow pure function unit tests without env vars
key_files:
  created:
    - packages/db/src/schema/materials.ts
    - apps/web/lib/storage.ts
    - apps/web/lib/storage.test.ts
    - packages/db/src/tests/seed.test.ts
    - apps/web/app/(ops)/products/actions.test.ts
    - packages/db/migrations/0001_curved_zaran.sql
  modified:
    - packages/db/src/schema/index.ts
    - packages/db/src/tests/schema.test.ts
    - packages/db/src/tests/rls.test.ts
decisions:
  - "StorageClient is lazy-initialised via getStorageClient() and getProductsBucket() factory functions — eager module-level instantiation throws ERR_INVALID_URL when SUPABASE_URL is undefined in test environment"
  - "productsBucket renamed to getProductsBucket() factory — aligns with lazy pattern and prevents test-time URL construction"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 9
requirements_covered:
  - PROD-06
---

# Phase 03 Plan 01: Material Library Schema and Wave 0 Test Stubs Summary

**One-liner:** Global `material_library` table with fail-closed RLS, lazy-init Supabase Storage path helpers, and Wave 0 test stubs covering all PROD requirements.

## Tasks Completed

| # | Task | Commit | Key Output |
|---|------|--------|-----------|
| 1 | Create material_library schema, install storage-js, create storage helpers | 954cfab | materials.ts, storage.ts, drizzle migration |
| 2 | Create all Wave 0 test stubs | bdbadfb | 5 test files, 3 green storage tests |

## Verification Results

- `pnpm --filter web exec -- npx vitest run lib/storage.test.ts` — **3 passing tests**
- `drizzle-kit generate` — migration `0001_curved_zaran.sql` generated for `material_library`
- `packages/db/src/schema/materials.ts` — exports `materialLibrary` with 3 RLS policies
- `packages/db/src/schema/index.ts` — includes `export * from './materials'`
- All 5 test files exist with correct stubs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] StorageClient eager instantiation fails in test environment**
- **Found during:** Task 2 verification (first vitest run)
- **Issue:** `new StorageClient(STORAGE_URL, ...)` at module level calls `new URL(STORAGE_URL)` internally, which throws `ERR_INVALID_URL` when `SUPABASE_URL` is `undefined` in the test environment — crashing all 3 storage path helper tests at collection time.
- **Fix:** Replaced eager `storageClient` constant and `productsBucket` constant with `getStorageClient()` and `getProductsBucket()` factory functions. StorageClient is only instantiated when actually called in a server context with env vars present.
- **Files modified:** `apps/web/lib/storage.ts`
- **Commit:** bdbadfb

## Self-Check: PASSED

All created files confirmed on disk. Both task commits (954cfab, bdbadfb) confirmed in git log.
