---
phase: 01-infrastructure-foundation
plan: 07
subsystem: testing
tags: [vitest, postgresql, rls, row-level-security, github-actions, ci, integration-tests]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation plan 02
    provides: Drizzle schema with RLS policies, withRLSContext wrapper, users and tenants tables

provides:
  - Vitest config for DB integration tests (packages/db/vitest.config.ts)
  - RLS cross-tenant isolation test proving tenant-A user sees zero tenant-B rows
  - Schema assertion tests for tenant_id index, user_role enum, and RLS enabled flags
  - GitHub Actions CI pipeline running lint, build, RLS tests, and security grep on every push

affects: [all future phases - CI now gates every push; RLS test is Phase 1 success criterion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RLS integration test pattern: open transaction, set JWT claims via set_config, assert row visibility, rollback via sentinel error"
    - "CI pipeline pattern: lint + build + integration-test + security-grep as separate jobs with postgres service container"

key-files:
  created:
    - packages/db/vitest.config.ts
    - packages/db/src/tests/setup.ts
    - packages/db/src/tests/rls.test.ts
    - packages/db/src/tests/schema.test.ts
    - .github/workflows/ci.yml
  modified: []

key-decisions:
  - "PGPASSWORD moved to env: block in CI — avoids inline shell variable which could be flagged by security scanners"
  - "Rollback sentinel pattern used in RLS tests — throw Error('ROLLBACK_SENTINEL') inside transaction then catch and swallow it; keeps test data clean without explicit rollback API"
  - "withRLSContext wrapper test uses dynamic import (await import('../rls')) — validates production code path separately from raw set_config tests"

patterns-established:
  - "Pattern: RLS test transactions use ROLLBACK_SENTINEL to clean up seeded data without a persistent transaction API"
  - "Pattern: DATABASE_URL_TEST env var separates test DB from production DB; tests fail fast if var is missing"
  - "Pattern: CI creates PostgreSQL roles via DO $$ block with IF NOT EXISTS guard — idempotent, safe to re-run"

requirements-completed: [ROUTE-04, ROUTE-05, AUTH-01, AUTH-10]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 01 Plan 07: RLS Integration Test Harness Summary

**Vitest RLS integration tests proving cross-tenant isolation via real PostgreSQL transactions, schema assertion tests for indexes and role enum, and GitHub Actions CI pipeline running all checks on every push to main**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T10:02:25Z
- **Completed:** 2026-03-20T10:05:43Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Vitest config, test setup with seed/cleanup helpers, and five RLS isolation tests covering tenant-A, tenant-B, reco-admin cross-tenant access, default-deny, and withRLSContext wrapper
- Schema assertion tests verifying tenant_id index, all six user_role enum values, RLS enabled on users and prison_facilities, audit_log columns
- GitHub Actions CI with four jobs: lint (biome), build (turbo), test-rls (postgres service + migrations + role grants + vitest), security-check (grep for service_role and superuser connection strings)

## Task Commits

Each task was committed atomically:

1. **Task 1: Vitest config, test setup, and test files** - `ef87497` (feat)
2. **Task 2: GitHub Actions CI pipeline** - `7da6496` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `packages/db/vitest.config.ts` - Vitest config with 30s timeout, node environment, setupFiles pointing to setup.ts
- `packages/db/src/tests/setup.ts` - Test DB connection via DATABASE_URL_TEST, seedTestData and cleanupTestData helpers, afterAll client teardown
- `packages/db/src/tests/rls.test.ts` - Five RLS tests: tenant-A isolation, tenant-B isolation, reco-admin cross-tenant, default-deny, withRLSContext wrapper validation
- `packages/db/src/tests/schema.test.ts` - Six schema assertions: tenant_id index, user_role enum (6 values), RLS enabled on users, RLS enabled on prison_facilities, audit_log columns, static service_role placeholder
- `.github/workflows/ci.yml` - Four-job CI pipeline triggered on push/PR to main and master

## Decisions Made

- PGPASSWORD moved to `env:` block in the CI role-creation step rather than inline shell variable — avoids potential security scanner warnings and follows GitHub Actions best practices
- Rollback sentinel pattern: throwing `Error('ROLLBACK_SENTINEL')` inside the test transaction and catching/swallowing it provides clean rollback without needing an explicit transaction rollback API
- withRLSContext wrapper test uses `await import('../rls')` dynamic import to validate the production code path independently from the raw `set_config` tests

## Deviations from Plan

None — plan executed exactly as written. Minor improvement: PGPASSWORD moved to `env:` block (security best practice, no behavioral change).

## Issues Encountered

None.

## User Setup Required

Tests require a real PostgreSQL instance. Before running tests locally, set `DATABASE_URL_TEST` in `.env.test` or shell environment pointing at an isolated test database with migrations applied and DB roles created.

In CI, the postgres service container handles this automatically.

## Next Phase Readiness

- Phase 1 success criterion #3 satisfied: RLS integration test harness exists and runs in CI
- CI pipeline gates every push — lint, build, RLS tests, and security grep all run on main and master
- `pnpm --filter @repo/db test` is the local command to run the full test suite
- `pnpm --filter @repo/db test:rls` runs only the RLS tests (faster feedback during development)

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-03-20*
