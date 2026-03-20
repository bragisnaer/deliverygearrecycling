---
phase: 01-infrastructure-foundation
plan: 03
subsystem: auth
tags: [next-auth, auth-js-v5, drizzle-adapter, microsoft-entra-id, resend, jwt, cross-subdomain-cookies]

# Dependency graph
requires:
  - phase: 01-01
    provides: Next.js app scaffolding and tsconfig path aliases
  - phase: 01-02
    provides: Drizzle schema (users table with role, tenant_id, location_id, facility_id, active columns) and db singleton

provides:
  - Auth.js v5 configuration with MicrosoftEntraID + Resend dual providers
  - JWT callbacks injecting role, tenant_id, location_id, facility_id from DB
  - Session callbacks exposing custom claims via auth() to server components
  - Cross-subdomain cookie scoped to .courierrecycling.com in production
  - Deactivated user sign-in blocking
  - Auth.js API route handler at /api/auth/[...nextauth]

affects:
  - All future phases requiring auth() session checks
  - Route guards in ops, client, and prison portals
  - RLS context (facility_id, tenant_id from JWT claims flow through to DB)

# Tech tracking
tech-stack:
  added:
    - "@auth/drizzle-adapter@1.11.1 — Auth.js adapter connecting to Drizzle schema"
    - "drizzle-orm added to apps/web dependencies (was only in @repo/db)"
    - "pnpm @auth/core override pinned to 0.41.0 to resolve version conflict with next-auth@beta"
  patterns:
    - "auth() called server-side to get session — never read raw JWT cookie"
    - "JWT claims loaded from DB on sign-in and on trigger=update for stale claim refresh"
    - "Cookie domain undefined in development, .courierrecycling.com (or AUTH_COOKIE_DOMAIN env override) in production"

key-files:
  created:
    - apps/web/auth.ts
    - apps/web/app/api/auth/[...nextauth]/route.ts
  modified:
    - apps/web/package.json
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "drizzle-orm added to apps/web dependencies (not just @repo/db) because auth.ts imports eq() directly"
  - "@auth/core pinned to 0.41.0 via pnpm workspace override — @auth/drizzle-adapter@1.11.1 pulls 0.41.1 which conflicts with next-auth@beta's 0.41.0 peer; single version required for TypeScript adapter type compatibility"
  - "AUTH_COOKIE_DOMAIN env var allows overriding .courierrecycling.com for Azure default domain phase before custom DNS is configured"
  - "location_id and facility_id are UUID columns in DB — converted to string in JWT (String(uuid)) to match JWT string token fields"

patterns-established:
  - "Pattern: import { db, users } from '@repo/db' — all DB schema is re-exported from index.ts, no @repo/db/schema subpath needed"
  - "Pattern: pnpm workspace overrides in root package.json to resolve peer dependency version conflicts"

requirements-completed: [AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-10]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 01, Plan 03: Auth.js v5 Configuration Summary

**Auth.js v5 with MicrosoftEntraID + Resend dual providers, JWT claims injection (role/tenant/location/facility), cross-subdomain cookies, and deactivated-user blocking**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T09:54:33Z
- **Completed:** 2026-03-20T09:58:48Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Auth.js v5 configured with dual providers: MicrosoftEntraID for reco staff, Resend magic link for external users
- JWT callback queries DB on sign-in (and on `trigger=update`) to inject role, tenant_id, location_id, facility_id into the token
- Session callback exposes all custom claims to server components via `auth()`
- Cross-subdomain cookie (`authjs.session-token`) scoped to `.courierrecycling.com` in production; undefined domain in development
- 7-day session maxAge covers prison facility sessions (AUTH-05)
- signIn callback reads `users.active` and returns false for deactivated accounts (AUTH-09)
- API route handler at `/api/auth/[...nextauth]` delegates GET + POST to Auth.js handlers
- Build passes with TypeScript checking — no type errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth.js v5 configuration with dual providers, JWT claims, cross-subdomain cookies** - `e89a7fa` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/web/auth.ts` — Auth.js v5 config: NextAuth export with DrizzleAdapter, MicrosoftEntraID, Resend, JWT/session callbacks, signIn guard, cookie domain
- `apps/web/app/api/auth/[...nextauth]/route.ts` — Route handler: `export const { GET, POST } = handlers`
- `apps/web/package.json` — Added `@auth/drizzle-adapter` and `drizzle-orm` to dependencies
- `package.json` — Added `pnpm.overrides["@auth/core": "0.41.0"]` to fix version conflict
- `pnpm-lock.yaml` — Updated lockfile with new dependencies and version override

## Decisions Made

- `@auth/core` pinned to `0.41.0` via pnpm workspace override — `@auth/drizzle-adapter@1.11.1` depends on `@auth/core@0.41.1` which conflicts with `next-auth@beta`'s `0.41.0`; TypeScript sees two incompatible `Adapter` types causing a type error on `DrizzleAdapter(db)`
- `AUTH_COOKIE_DOMAIN` env var accepted as override for `.courierrecycling.com`, enabling use of Azure default domain during pre-DNS-cutover deployment
- `location_id` and `facility_id` are `uuid` columns in the DB — stored as string in JWT using `String()` conversion to match the `string | null` JWT token field types

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added @auth/drizzle-adapter and drizzle-orm to apps/web dependencies**
- **Found during:** Task 1 (build verification)
- **Issue:** `apps/web/auth.ts` imports `@auth/drizzle-adapter` (only in `@repo/db` devDependencies) and `drizzle-orm` (only in `@repo/db` dependencies) — both missing from `apps/web`
- **Fix:** Added both to `apps/web/package.json` dependencies; ran `pnpm install`
- **Files modified:** `apps/web/package.json`, `pnpm-lock.yaml`
- **Verification:** Build compiled successfully after install
- **Committed in:** `e89a7fa` (Task 1 commit)

**2. [Rule 3 - Blocking] Added pnpm @auth/core version override to resolve TypeScript conflict**
- **Found during:** Task 1 (second build attempt after dependency install)
- **Issue:** `@auth/drizzle-adapter@1.11.1` depends on `@auth/core@0.41.1`; `next-auth@beta` uses `@auth/core@0.41.0` — TypeScript type-checks `Adapter.createUser` against two incompatible `AdapterUser` types
- **Fix:** Added `pnpm.overrides: { "@auth/core": "0.41.0" }` to root `package.json`; ran `pnpm install`
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** Build compiled with TypeScript passing in 2.1s
- **Committed in:** `e89a7fa` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking missing dependencies)
**Impact on plan:** Both fixes necessary to satisfy import requirements and resolve the TypeScript version conflict. No scope creep — all fixes are direct prerequisites of the planned auth.ts file.

## Issues Encountered

- `@repo/db/schema` subpath import does not resolve (no `exports` field in db package.json) — fixed by importing from `@repo/db` directly, which re-exports everything via `export * from './schema'` in its index.ts

## User Setup Required

None — no external service configuration required for build. Runtime requires environment variables (`AUTH_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER`, `AUTH_RESEND_KEY`) which are standard configuration, not code changes.

## Next Phase Readiness

- Auth.js v5 configuration ready — server components can call `auth()` to get session with role/tenant/location/facility claims
- DrizzleAdapter connected — magic link verification tokens stored via existing schema
- Cookie domain configured for cross-subdomain SSO readiness
- Route guard pattern: `const session = await auth(); if (!session?.user || session.user.role !== 'reco-admin') redirect('/sign-in')`

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-03-20*
