---
phase: 01-infrastructure-foundation
plan: 04
subsystem: infra
tags: [nextjs, proxy, tenant-routing, vitest, multi-tenancy, subdomain]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation/01-01
    provides: Turborepo monorepo scaffold with packages/types containing TenantContext type
provides:
  - "Subdomain-based tenant resolution via proxy.ts — pure hostname parsing, no DB call"
  - "x-tenant-context and x-tenant-id headers injected on every matched request"
  - "getTenantFromHost() pure function — testable independently of Next.js"
  - "Azure default domain fallback to ops context"
  - "Localhost dev subdomain support (ops.localhost, bare localhost)"
  - "Unit test suite (10 tests) covering all hostname patterns"
affects:
  - "02-auth — proxy.ts headers available to auth route handlers"
  - "All future route group layouts consuming x-tenant-context header"
  - "03-settings — ops context enforced before settings routes"

# Tech tracking
tech-stack:
  added:
    - "vitest ^3.1.0 (devDependency in @repo/web)"
  patterns:
    - "proxy.ts over middleware.ts — Next.js 16 naming convention"
    - "getTenantFromHost() pure helper exported separately for unit testability"
    - "domainMode parameter for Azure-default vs custom domain environments"
    - "NEXT_PUBLIC_DOMAIN_MODE env var for deployment-time domain mode selection"

key-files:
  created:
    - "apps/web/proxy.ts — tenant resolution + header injection + matcher config"
    - "apps/web/proxy.test.ts — 10 vitest unit tests for all hostname patterns"
    - "apps/web/vitest.config.ts — vitest config for @repo/web package"
  modified:
    - "apps/web/package.json — added test script and vitest devDependency"

key-decisions:
  - "getTenantFromHost() exported as pure function separate from proxy() for independent unit testability"
  - "domainMode parameter with NEXT_PUBLIC_DOMAIN_MODE fallback allows deployment-time switching between azure-default and custom domain behaviour"
  - "ops.localhost treated as ops context — enables local dev with subdomain simulation"
  - "Pre-existing build failure in packages/types/src/auth.ts (next-auth/jwt augmentation) logged as out-of-scope deferred item — predates this plan"

patterns-established:
  - "Pattern: Pure subdomain extraction — hostname.split(':')[0] strips port, then split('.') for parts"
  - "Pattern: Localhost TLD check before length check — handles ops.localhost (2 parts, tld=localhost)"
  - "Pattern: Azure fallback — domainMode=azure-default OR hostname.endsWith('.azurecontainerapps.io')"

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-03]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 01 Plan 04: proxy.ts Tenant Resolution Summary

**Next.js 16 proxy.ts with pure subdomain parsing resolving ops/client/public domain contexts and injecting x-tenant-context + x-tenant-id headers, with 10 vitest unit tests covering all hostname patterns including Azure default and localhost dev**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-20T09:44:40Z
- **Completed:** 2026-03-20T10:47:00Z
- **Tasks:** 1 of 1
- **Files modified:** 5

## Accomplishments

- `proxy.ts` resolves all three domain contexts (ops, client, public) from hostname alone — zero database calls
- `getTenantFromHost()` exported as a pure, independently testable function with `domainMode` parameter for Azure vs custom domain switching
- 10 unit tests cover all required hostname patterns: ops subdomain, client tenant slugs, apex domain, www, Azure default domain (both by `domainMode` flag and by `.azurecontainerapps.io` suffix), localhost bare, localhost with subdomain, port stripping
- Matcher config excludes `_next/static`, `_next/image`, `favicon.ico`, `sitemap.xml`, `robots.txt`

## Task Commits

1. **Task 1: Implement proxy.ts with subdomain parsing and header injection** — `e5e94a4` (feat)

**Plan metadata:** (docs commit below)

_Note: TDD — RED phase confirmed import failure, GREEN phase fixed logic bug for ops.localhost before all 10 tests passed_

## Files Created/Modified

- `apps/web/proxy.ts` — `getTenantFromHost()` pure function + `proxy()` Next.js handler + `config` matcher
- `apps/web/proxy.test.ts` — 10 vitest tests covering all hostname patterns from plan spec
- `apps/web/vitest.config.ts` — vitest config (node environment, include `**/*.test.ts`)
- `apps/web/package.json` — added `"test": "vitest run"` script + `vitest ^3.1.0` devDependency
- `pnpm-lock.yaml` — lockfile updated with vitest resolution

## Decisions Made

- `getTenantFromHost()` takes an explicit `domainMode` parameter (defaulting to `process.env.NEXT_PUBLIC_DOMAIN_MODE ?? 'custom'`) so tests can pass the mode directly without needing environment variable setup
- `ops.localhost` handled by checking `tld === 'localhost'` before the `parts.length <= 2` branch, since `ops.localhost` splits to 2 parts and would otherwise fall through to `public`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ops.localhost:3000 returning public instead of ops context**
- **Found during:** Task 1 (GREEN phase — first test run)
- **Issue:** `ops.localhost` splits to `['ops', 'localhost']` (2 parts), which fell into the `<= 2` length branch before the subdomain check. The `hostname === 'localhost'` guard didn't match `ops.localhost`, so it returned `public`.
- **Fix:** Moved localhost TLD detection before the length check. When `tld === 'localhost'`, parse subdomain first (ops → ops context, www → public, other → client), then fall through to normal length-based logic.
- **Files modified:** `apps/web/proxy.ts`
- **Verification:** All 10 tests pass including `resolves ops.localhost:3000 to ops context`
- **Committed in:** `e5e94a4` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - logic bug)
**Impact on plan:** Required for localhost dev subdomain simulation to work correctly. No scope creep.

## Issues Encountered

Pre-existing build failure in `packages/types/src/auth.ts` (line 33): `declare module "next-auth/jwt"` augmentation fails TypeScript resolution. Confirmed pre-existing (present in commit `74d7e41` before this plan). Logged to `deferred-items.md`. Does not affect proxy.ts unit tests which pass independently.

## User Setup Required

None — no external service configuration required. Set `NEXT_PUBLIC_DOMAIN_MODE=azure-default` in Azure Container Apps environment if deploying to Azure default domain before custom DNS is configured.

## Next Phase Readiness

- `proxy.ts` is the routing foundation for all future phases — all Server Components can read `x-tenant-context` and `x-tenant-id` from request headers
- Auth plan (01-03 or next) can rely on tenant context being available before any route handler runs
- Pre-existing `next-auth/jwt` build error in `packages/types/src/auth.ts` must be resolved before `pnpm turbo build` succeeds — deferred to the plan that owns auth type augmentation

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-03-20*
