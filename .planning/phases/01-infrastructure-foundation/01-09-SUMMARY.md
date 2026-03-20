---
phase: 01-infrastructure-foundation
plan: 09
subsystem: security/testing
tags: [auth, rls, static-analysis, vitest, filesystem-scan]
dependency_graph:
  requires: []
  provides: [AUTH-10-test-coverage]
  affects: [packages/db/src/tests/schema.test.ts]
tech_stack:
  added: []
  patterns: [node:fs recursive scan in Vitest, synchronous static assertion]
key_files:
  modified:
    - packages/db/src/tests/schema.test.ts
decisions:
  - Synchronous fs.readdirSync used — test does not need async/await and runs without DB connection
  - Forbidden terms list mirrors CI grep pattern (service_role, SUPABASE_SERVICE_ROLE, postgresql://postgres:postgres@)
  - __dirname path ../../../../apps/web/app/api navigates correctly from packages/db/src/tests/ to monorepo root
metrics:
  duration: 77s
  completed: "2026-03-20T11:05:58Z"
  tasks_completed: 1
  files_modified: 1
---

# Phase 01 Plan 09: Replace service_role stub with real filesystem scan — Summary

**One-liner:** Replaced always-passing stub with recursive Node.js fs scan of apps/web/app/api/ that fails if service_role or superuser strings appear in any route file.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace stub with real filesystem scan assertion | f3a5963 | packages/db/src/tests/schema.test.ts |

## What Was Built

The stub test `expect(true).toBe(true)` on line 70 of `schema.test.ts` was replaced with a real synchronous recursive filesystem scan. The replacement:

1. Imports `readdirSync`, `readFileSync` from `node:fs` and `join` from `node:path`
2. Walks `apps/web/app/api/` recursively collecting all `.ts` and `.tsx` files
3. Reads each file and asserts none contain: `service_role`, `SUPABASE_SERVICE_ROLE`, or `postgresql://postgres:postgres@`
4. Reports the exact file and forbidden term if a violation is found

The test is synchronous and passes without a live database connection (confirmed: green checkmark with no PostgreSQL running locally).

## Verification

- `grep -n "expect(true)"` — no matches in schema.test.ts
- `grep -n "readdirSync"` — present at import and usage
- Test output: `✓ Schema assertions > no service_role or superuser references in API routes 1ms`
- All 5 other tests fail only due to missing local PostgreSQL (pre-existing, unrelated)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- packages/db/src/tests/schema.test.ts — FOUND (modified)
- Commit f3a5963 — FOUND
- Stub `expect(true).toBe(true)` — REMOVED (confirmed via grep)
- Real scan — PRESENT (readdirSync confirmed)
