---
phase: 01-infrastructure-foundation
plan: 02
subsystem: database
tags: [drizzle-orm, drizzle-kit, postgres, rls, postgresql, pgpolicy, pgenum, audit-log, multi-tenant]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation/01-01
    provides: monorepo scaffold, packages/db package.json with drizzle-orm and postgres installed

provides:
  - "Drizzle schema: users, accounts, verification_tokens, tenants, prison_facilities, system_settings, audit_log"
  - "PostgreSQL RLS policies on all tenant-scoped tables (deny-all base + role-specific allow)"
  - "user_role pgEnum with 6 values: reco-admin, reco, client, client-global, transport, prison"
  - "tenant_id index on users table (ROUTE-05)"
  - "Audit trigger function SQL (SECURITY DEFINER) applied to all editable tables"
  - "DB connection singleton (drizzle + postgres, max 10 connections)"
  - "withRLSContext() transaction wrapper — sets JWT claims + SET LOCAL ROLE per request"
  - "Initial migration 0000 (Drizzle-generated) + manual migration 0001 (FORCE RLS + triggers + seed)"

affects:
  - 01-03-auth (DrizzleAdapter requires users, accounts, verification_tokens tables)
  - 01-04-proxy (db export from @repo/db)
  - 01-05-settings-ui (db, systemSettings, prisonFacilities, withRLSContext)
  - all future phases (schema is foundational dependency)

# Tech tracking
tech-stack:
  added:
    - "@types/node ^22.0.0 (devDep in packages/db — needed for process.env)"
  patterns:
    - "pgPolicy with as: 'restrictive' + using: sql`false` as deny-all base on every tenant-scoped table"
    - "Explicit allow policies per PostgreSQL role (reco_admin, reco_role, client_role, prison_role, transport_role)"
    - "FORCE ROW LEVEL SECURITY via manual migration (ensures table owner cannot bypass RLS)"
    - "withRLSContext() wrapper: every DB operation goes through a transaction that sets JWT claims via SET LOCAL set_config, then SET LOCAL ROLE"
    - "Manual migration 0001 for non-Drizzle SQL (FORCE RLS, triggers, seed data)"
    - "AUDIT_TRIGGER_SQL constant exported from audit.ts for documentation and future reference"

key-files:
  created:
    - packages/db/src/schema/auth.ts
    - packages/db/src/schema/tenants.ts
    - packages/db/src/schema/settings.ts
    - packages/db/src/schema/audit.ts
    - packages/db/src/schema/index.ts
    - packages/db/src/db.ts
    - packages/db/src/rls.ts
    - packages/db/drizzle.config.ts
    - packages/db/migrations/0000_naive_mentallo.sql
    - packages/db/migrations/0001_rls_and_triggers.sql
  modified:
    - packages/db/src/index.ts
    - packages/db/package.json

key-decisions:
  - "Drizzle pgPolicy generates ENABLE ROW LEVEL SECURITY automatically for tables with policies — FORCE RLS added via manual migration 0001"
  - "Prison facilities RLS uses prisonRole (prison_role) not recoAdminRole — corrected during schema authoring"
  - "@types/node auto-added as devDependency when process.env access in db.ts caused TS2580 error"
  - "AUDIT_TRIGGER_SQL constant kept in audit.ts as documentation alongside the table definition"
  - "Manual migration 0001 covers FORCE RLS, audit trigger creation, and system_settings seed INSERT"

patterns-established:
  - "Pattern: RLS deny-all base — every tenant-scoped table starts with pgPolicy as: 'restrictive', using: sql`false`"
  - "Pattern: withRLSContext — all tenant-scoped queries wrapped in transaction that sets JWT claims via SET LOCAL"
  - "Pattern: Manual migration for non-Drizzle SQL — 0001_rls_and_triggers.sql augments Drizzle-generated migration"

requirements-completed: [ROUTE-04, ROUTE-05, AUTH-01, AUTH-07, AUTH-08, SETTINGS-01, SETTINGS-02]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 01 Plan 02: Drizzle Schema, RLS Policies, and DB Connection Summary

**Drizzle ORM schema for 7 tables with PostgreSQL RLS deny-all base policies, role-specific allow policies, tenant_id indexes, audit log trigger, and transaction-scoped RLS context wrapper**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T09:35:37Z
- **Completed:** 2026-03-20T09:40:37Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Complete Drizzle schema covering Auth.js adapter tables (users, accounts, verification_tokens), tenants, prison_facilities, system_settings, and audit_log — all with correct column types, indexes, and RLS policies
- PostgreSQL RLS: deny-all restrictive base policy + explicit allow policies per pg role on every tenant-scoped table; FORCE RLS via manual migration ensures table owner cannot bypass
- DB connection singleton (postgres driver, max 10 connections) and withRLSContext() transaction wrapper that sets JWT claims + switches PostgreSQL role per request — the primary DB access pattern for all future phases

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Drizzle schema files** - `8241e15` (feat)
2. **Task 2: Create DB connection singleton and RLS-aware query wrapper** - `3666249` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `packages/db/src/schema/auth.ts` - user_role pgEnum, users/accounts/verification_tokens tables with RLS policies
- `packages/db/src/schema/tenants.ts` - tenants and prison_facilities tables with RLS policies
- `packages/db/src/schema/settings.ts` - system_settings singleton table with CHECK constraint and RLS policies
- `packages/db/src/schema/audit.ts` - audit_log table, indexes, AUDIT_TRIGGER_SQL constant
- `packages/db/src/schema/index.ts` - barrel export of all 4 schema modules
- `packages/db/src/db.ts` - drizzle() singleton with postgres driver, max 10 connections
- `packages/db/src/rls.ts` - withRLSContext() wrapper, mapAppRoleToPgRole() mapping
- `packages/db/src/index.ts` - exports db, withRLSContext, and all schema tables
- `packages/db/drizzle.config.ts` - defineConfig with schema: './src/schema'
- `packages/db/migrations/0000_naive_mentallo.sql` - Drizzle-generated initial migration (tables, types, roles, policies, indexes)
- `packages/db/migrations/0001_rls_and_triggers.sql` - Manual: FORCE RLS, audit trigger function, seed system_settings
- `packages/db/package.json` - added @types/node devDependency

## Decisions Made

- Drizzle automatically generates `ENABLE ROW LEVEL SECURITY` when `pgPolicy` is present on a table; `FORCE ROW LEVEL SECURITY` added separately via manual migration 0001 to ensure superuser cannot bypass
- `AUDIT_TRIGGER_SQL` exported as a TypeScript constant from `audit.ts` for inline documentation alongside the table definition; the actual SQL is also in migration 0001
- `mapAppRoleToPgRole` maps `client` and `client-global` both to `client_role` — they share the same PostgreSQL role but differ in application-level authorization logic

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @types/node devDependency**
- **Found during:** Task 2 (db.ts creation)
- **Issue:** `process.env` in `db.ts` caused TS2580 "Cannot find name 'process'" — @types/node was not present in packages/db
- **Fix:** `pnpm add -D @types/node` in packages/db
- **Files modified:** packages/db/package.json, pnpm-lock.yaml
- **Verification:** `npx tsc --noEmit` in packages/db exited 0 after install
- **Committed in:** 3666249 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary devDependency gap. No scope creep.

## Issues Encountered

- Drizzle generates `CREATE ROLE` (not `CREATE ROLE IF NOT EXISTS`) for pgRole entries — in production, these roles must exist before migration or the migration will fail. Noted as a deployment concern; the migration SQL should be reviewed before first run on a fresh Azure PostgreSQL instance.

## User Setup Required

None — no external service configuration required for this plan. The migrations will be run in plan 01-06 (deployment) when the Azure PostgreSQL instance is available.

## Next Phase Readiness

- `@repo/db` exports `db`, `withRLSContext`, and all schema tables — ready for Auth.js DrizzleAdapter in plan 01-03
- Drizzle migration files ready to run on Azure PostgreSQL once provisioned
- RLS patterns established for all future phases to follow when adding tables

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-03-20*
