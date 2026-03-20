---
phase: 02-auth-roles-and-tenant-branding
plan: "02"
subsystem: middleware/auth
tags: [middleware, auth, routing, prison, role-based-redirect]
dependency_graph:
  requires: [02-01]
  provides: [role-based-post-login-redirect, wrong-portal-redirect, prison-magic-link-callback]
  affects: [apps/web/proxy.ts, apps/web/middleware.ts, apps/web/app/api/prison/send-login/route.ts]
tech_stack:
  added: []
  patterns: [auth-wrapped-middleware, vitest-module-mocking]
key_files:
  created:
    - apps/web/__mocks__/auth.ts
    - apps/web/__mocks__/next-auth.ts
    - apps/web/__mocks__/next-server.ts
  modified:
    - apps/web/proxy.ts
    - apps/web/vitest.config.ts
    - apps/web/app/api/prison/send-login/route.ts
decisions:
  - "auth() wrapper from Auth.js v5 used to wrap proxy function — session injected as request.auth in middleware"
  - "ROLE_DESTINATIONS map covers all 6 roles: reco-admin/reco/transport→/dashboard, client/client-global→/overview, prison→/prison"
  - "Vitest alias array ordering required (specific before generic) for @/auth mock to take precedence over generic @ alias"
  - "__mocks__ directory created for next-auth, next/server, and @/auth to keep proxy.test.ts isolated from Next.js/DB runtime"
  - "api/auth excluded from middleware matcher to prevent Auth.js callback interception"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 6
---

# Phase 02 Plan 02: Role-Based Redirect and Prison Login Summary

Auth-wrapped middleware with ROLE_DESTINATIONS routing, wrong-portal redirects, and prison magic-link callbackUrl fixed to `/prison`.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wrap proxy.ts with auth() for session-aware middleware | 84b679c | proxy.ts, vitest.config.ts, __mocks__/* |
| 2 | Update prison login callbackUrl to /prison | 5c278fa | app/api/prison/send-login/route.ts |

## What Was Built

### Task 1: Auth-Wrapped Middleware

`apps/web/proxy.ts` was restructured from a plain function to an `auth()`-wrapped middleware (Auth.js v5 pattern). The session is now available as `(request as any).auth` inside the middleware function.

Added logic:
- **Wrong-portal redirect (client on ops):** Client/client-global users hitting the ops portal are redirected to `{tenantId}.{domain}/overview`
- **Wrong-portal redirect (reco on client):** reco-admin/reco/transport hitting a client subdomain are redirected to `ops.{domain}/dashboard`
- **Post-login root redirect:** Users landing on `/` after sign-in are redirected to their role's destination via `ROLE_DESTINATIONS`
- **`api/auth` excluded from matcher** so Auth.js callback URLs are never intercepted

`getTenantFromHost` remains unchanged as a named export — all 10 existing proxy tests continue to pass.

### Task 2: Prison Magic Link callbackUrl

Changed `callbackUrl: '/'` to `callbackUrl: '/prison'` in `apps/web/app/api/prison/send-login/route.ts`. Prison staff now land directly on `/prison` after clicking their magic link, bypassing the root-redirect entirely.

`/prison/login?facility=X` remains at its stable path — not inside any route group, accessible without auth.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest proxy.test.ts broke after auth() import**

- **Found during:** Task 1 verification
- **Issue:** `proxy.ts` now imports `@/auth` (which imports `next-auth`), and `next-auth@beta` tries to load `next/server` without `.js` extension — fails in Vitest's Node environment
- **Fix:** Created `apps/web/__mocks__/` directory with stubs for `next-auth`, `next/server`, and `@/auth`. Updated `vitest.config.ts` to use array-ordered aliases (most-specific first) so `@/auth` mock takes precedence over the generic `@` alias
- **Files modified:** `apps/web/vitest.config.ts`, `apps/web/__mocks__/auth.ts`, `apps/web/__mocks__/next-auth.ts`, `apps/web/__mocks__/next-server.ts`
- **Commit:** 84b679c

## Success Criteria Verification

| Criteria | Status |
|----------|--------|
| proxy.ts wrapped with auth() — session in middleware | PASS |
| Wrong-portal redirect: client on ops → tenant subdomain | PASS |
| Wrong-portal redirect: reco on client → ops | PASS |
| Post-login "/" redirect routes each role correctly | PASS |
| Prison magic link callbackUrl is /prison | PASS |
| Prison login page at stable /prison/login?facility=X | PASS |
| Existing proxy tests still pass (10/10) | PASS |
| TypeScript compilation passes | PASS |

## Self-Check

Verified below.
