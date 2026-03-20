---
phase: 01-infrastructure-foundation
verified: 2026-03-20T11:30:00Z
status: human_needed
score: 17/17 truths verified
re_verification: true
  previous_status: gaps_found
  previous_score: 14/17
  gaps_closed:
    - "proxy.ts resolves tenant context from subdomain hostname without any database call (middleware.ts now exists and activates proxy())"
    - "x-tenant-context and x-tenant-id headers are injected for all matched routes (downstream of middleware.ts fix)"
    - "No service_role key or superuser connection string appears in any API route (stub replaced with real filesystem scan)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Confirm settings page loads and saves for reco-admin"
    expected: "Exchange rate, warehouse threshold, and discrepancy threshold forms render with current values, save button is disabled when pristine, shows loading state while saving, success toast appears after save"
    why_human: "Requires running app with authenticated reco-admin session and real database"
  - test: "Confirm prison login flow sends magic link"
    expected: "Navigating to /prison/login?facility=vejle-fengsel shows facility slug, clicking 'Send login link' triggers POST to /api/prison/send-login, Resend delivers magic link to facility contact_email"
    why_human: "Requires live Resend API key and a seeded prison facility record"
  - test: "Confirm auth guard redirects unauthenticated users"
    expected: "Accessing any (ops) or (client) route without a session redirects to /sign-in"
    why_human: "Requires running Next.js server with no active session cookie"
---

# Phase 1: Infrastructure Foundation Verification Report

**Phase Goal:** The platform infrastructure is live and secure; every subsequent feature can be built on top without revisiting security or schema
**Verified:** 2026-03-20T11:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plans 01-08 and 01-09)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | pnpm-workspace.yaml configures monorepo with apps/web | VERIFIED | `pnpm-workspace.yaml` declares `apps/*` and `packages/*`; `apps/web/package.json` exists as `@repo/web` |
| 2 | turbo.json provides task orchestration | VERIFIED | `turbo.json` exists at root |
| 3 | biome.json provides linting config | VERIFIED | `biome.json` exists at root |
| 4 | Next.js 16 app scaffolded with Tailwind v4 and shadcn/ui | VERIFIED | `apps/web/package.json` declares `next: 16.2.0`, `tailwindcss: ^4.0.0`, `shadcn: ^4.1.0`, `components.json` present |
| 5 | Multi-stage Dockerfile present | VERIFIED | `apps/web/Dockerfile` exists |
| 6 | UserRole type and TenantContext type exist as shared types | VERIFIED | `packages/types/src/auth.ts` exports `UserRole` with all six values; `packages/types/src/tenant.ts` exports `TenantContext` |
| 7 | apps/web depends on @repo/db and @repo/types | VERIFIED | `apps/web/package.json` lists `@repo/db: workspace:*` and `@repo/types: workspace:*` |
| 8 | proxy.ts resolves tenant context from subdomain without DB call | VERIFIED | `apps/web/middleware.ts` exists (commit c9b0fde) and contains `export { proxy as middleware, config } from './proxy'` — Next.js now executes proxy() on every matched request |
| 9 | x-tenant-context and x-tenant-id headers injected for all matched routes | VERIFIED | Downstream of middleware.ts fix — proxy() is now invoked; proxy.ts logic was verified correct in initial verification |
| 10 | Every tenant-scoped table has tenant_id column, RLS USING(false) default deny, and tenant_id index | VERIFIED | `schema/auth.ts` (users): tenant_id column + `users_tenant_id_idx` + `users_deny_all` restrictive policy. `schema/tenants.ts`: `tenants_deny_all`. `schema/settings.ts`: `system_settings_deny_all`. `schema/tenants.ts` prisonFacilities: `prison_facilities_deny_all`. |
| 11 | Six user roles exist as PostgreSQL enum | VERIFIED | `userRoleEnum = pgEnum('user_role', ['reco-admin','reco','client','client-global','transport','prison'])` in `schema/auth.ts` |
| 12 | Audit log trigger function exists and applied to all editable tables | VERIFIED | `AUDIT_TRIGGER_SQL` in `schema/audit.ts` defines function + triggers on users, tenants, prison_facilities, system_settings |
| 13 | Auth.js v5 configured with Entra ID + Resend providers, JWT claims injected, cross-subdomain cookie | VERIFIED | `apps/web/auth.ts`: both providers present, jwt callback injects role/tenant_id/location_id/facility_id, cookie domain set to `.courierrecycling.com` in production, 7-day maxAge |
| 14 | DrizzleAdapter connects Auth.js to @repo/db schema | VERIFIED | `auth.ts` line 10: `DrizzleAdapter(db)` where db is imported from `@repo/db` |
| 15 | Route groups enforce auth: (ops) allows reco roles, (client) allows client roles, unauthenticated redirected | VERIFIED | `(ops)/layout.tsx`: `requireAuth(['reco-admin','reco','transport','prison'])`. `(client)/layout.tsx`: `requireAuth(['client','client-global'])`. `lib/auth-guard.ts` redirects to /sign-in if no session, /access-denied if wrong role. |
| 16 | Settings page: reco-admin can edit exchange rate, thresholds, and prison facility registry | VERIFIED | `(ops)/settings/page.tsx` guards with `requireAuth(['reco-admin'])`. `general-settings-form.tsx` renders exchange rate + threshold forms. `facilities-table.tsx` renders inline-editable table. `actions.ts` queries systemSettings and prisonFacilities. |
| 17 | No service_role key or superuser connection string in any API route | VERIFIED | `schema.test.ts` line 70 replaced with real recursive filesystem scan via `readdirSync`; scans all `.ts`/`.tsx` files under `apps/web/app/api/` for `service_role`, `SUPABASE_SERVICE_ROLE`, and `postgresql://postgres:postgres@`; stub `expect(true).toBe(true)` confirmed removed (commit f3a5963) |

**Score:** 17/17 truths verified

---

## Re-verification: Gap Closure Results

### Gap 1 — Missing middleware.ts (CLOSED)

**Previous status:** BLOCKER — proxy.ts was dead code; Next.js never executed proxy()

**Fix applied (plan 01-08, commit c9b0fde):** `apps/web/middleware.ts` created with content:
```
export { proxy as middleware, config } from './proxy'
```

**Verification:** File read directly — content confirmed exact. This single re-export satisfies Next.js's requirement that middleware live in a file named `middleware.ts` at the app root. proxy() is now invoked on every request matching `config.matcher`. ROUTE-01 and ROUTE-02 are active at runtime.

### Gap 2 — Stub test for AUTH-10 (CLOSED)

**Previous status:** WARNING — `expect(true).toBe(true)` stub always passed regardless of codebase state

**Fix applied (plan 01-09, commit f3a5963):** Replaced stub with real recursive filesystem scan using `readdirSync` and `readFileSync` from `node:fs`. Scans all `.ts`/`.tsx` files under `apps/web/app/api/` for three forbidden terms.

**Verification:** Grep of `schema.test.ts` confirms:
- `expect(true).toBe(true)` — NOT present (stub removed)
- `readdirSync` — present at import and usage
- `service_role` — present only as the forbidden-term string being checked for, not as a key value

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `pnpm-workspace.yaml` | Workspace configuration | VERIFIED | Contains `apps/*` and `packages/*` |
| `turbo.json` | Turborepo task orchestration | VERIFIED | Present at root |
| `biome.json` | Linting and formatting config | VERIFIED | Present at root |
| `apps/web/next.config.ts` | Next.js 16 configuration | VERIFIED | Present; declares `transpilePackages`, `output: standalone` |
| `apps/web/Dockerfile` | Multi-stage container build | VERIFIED | Present |
| `apps/web/proxy.ts` | Subdomain-based tenant resolution logic | VERIFIED | Exports `proxy` + `config`; now consumed by middleware.ts |
| `apps/web/middleware.ts` | Next.js middleware entry point | VERIFIED | Created commit c9b0fde; re-exports proxy as middleware and config |
| `packages/types/src/auth.ts` | UserRole type | VERIFIED | Exports `UserRole` and `USER_ROLES` array |
| `packages/types/src/tenant.ts` | TenantContext type | VERIFIED | Exports `DomainContext` and `TenantContext` |
| `packages/db/src/schema/auth.ts` | Auth.js adapter tables + custom columns | VERIFIED | users, accounts, verificationTokens with role, tenant_id, location_id, facility_id, can_view_financials, active |
| `packages/db/src/schema/tenants.ts` | Tenant and prison facility tables | VERIFIED | tenants + prisonFacilities with slug, name, address, contact_email, active, RLS policies |
| `packages/db/src/schema/settings.ts` | System settings table | VERIFIED | systemSettings with exchange_rate, warehouse_ageing_threshold_days, discrepancy_alert_threshold_pct |
| `packages/db/src/schema/audit.ts` | Audit log table and trigger SQL | VERIFIED | auditLog table + AUDIT_TRIGGER_SQL covering all four editable tables |
| `packages/db/src/db.ts` | Drizzle DB connection singleton | VERIFIED | Exports `db = drizzle(client, { schema })` |
| `packages/db/src/rls.ts` | RLS-aware query wrapper | VERIFIED | `withRLSContext` sets JWT claims + SET LOCAL ROLE per request |
| `packages/db/drizzle.config.ts` | Drizzle Kit migration config | VERIFIED | `defineConfig` with schema path and postgresql dialect |
| `apps/web/auth.ts` | Auth.js v5 configuration | VERIFIED | Dual providers, JWT callbacks, session callback, 7-day maxAge, subdomain cookie |
| `apps/web/app/api/auth/[...nextauth]/route.ts` | Auth.js route handler | VERIFIED | Imports and re-exports `handlers` from `@/auth` |
| `apps/web/app/(ops)/layout.tsx` | Ops portal layout with auth guard | VERIFIED | Calls `requireAuth(['reco-admin','reco','transport','prison'])` |
| `apps/web/app/(client)/layout.tsx` | Client portal layout with auth guard | VERIFIED | Calls `requireAuth(['client','client-global'])` |
| `apps/web/app/(public)/layout.tsx` | Public marketing site layout | VERIFIED | Unauthenticated shell — no auth guard |
| `apps/web/app/sign-in/page.tsx` | Sign-in page with provider selection | VERIFIED | Entra ID button + Resend magic link form, both call `signIn()` |
| `apps/web/app/prison/login/page.tsx` | Prison facility login page | VERIFIED | Reads `?facility=` param, POSTs to `/api/prison/send-login` |
| `apps/web/lib/auth-guard.ts` | Reusable server-side auth guard | VERIFIED | `requireAuth()` checks session and role, redirects to /sign-in or /access-denied |
| `apps/web/app/(ops)/settings/page.tsx` | System Settings page with tabs | VERIFIED | Guards with `requireAuth(['reco-admin'])`, renders Tabs with General + Facilities |
| `apps/web/app/(ops)/settings/general-settings-form.tsx` | Exchange rate and thresholds form | VERIFIED | ExchangeRateCard + AlertThresholdsCard with pristine-check, loading state, toast feedback |
| `apps/web/app/(ops)/settings/facilities-table.tsx` | Inline editable prison facility table | VERIFIED | Full inline editing, add row, archive with dialog, save-all button |
| `apps/web/app/(ops)/settings/actions.ts` | Server Actions for settings CRUD | VERIFIED | `saveGeneralSettings`, `getFacilities`, `createFacility`, `updateFacility`, `archiveFacility` — all guard with `requireRecoAdmin()` |
| `packages/db/vitest.config.ts` | Vitest config for DB integration tests | VERIFIED | Present |
| `packages/db/src/tests/rls.test.ts` | RLS cross-tenant isolation test | VERIFIED | 5 tests covering cross-tenant isolation, reco-admin visibility, default deny, withRLSContext wrapper |
| `packages/db/src/tests/schema.test.ts` | Schema assertions for indexes and roles | VERIFIED | Stub removed; now contains real filesystem scan for service_role forbidden terms |
| `.github/workflows/ci.yml` | GitHub Actions CI pipeline | VERIFIED | lint, build, test-rls (with real PostgreSQL service), security-check (grep for service_role) jobs all present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/middleware.ts` | `apps/web/proxy.ts` | re-export | WIRED | `export { proxy as middleware, config } from './proxy'` — Next.js now invokes proxy() |
| `apps/web/package.json` | `packages/db` | workspace dependency `@repo/db` | WIRED | `"@repo/db": "workspace:*"` present |
| `apps/web/package.json` | `packages/types` | workspace dependency `@repo/types` | WIRED | `"@repo/types": "workspace:*"` present |
| `packages/db/src/db.ts` | `packages/db/src/schema/index.ts` | schema import | WIRED | `import * as schema from './schema'` |
| `packages/db/src/rls.ts` | `packages/db/src/db.ts` | db import for transactions | WIRED | `import { db } from './db'` |
| `apps/web/auth.ts` | `packages/db/src/db.ts` | DrizzleAdapter(db) | WIRED | `DrizzleAdapter(db)` where db imported from `@repo/db` |
| `apps/web/auth.ts` | `packages/types/src/auth.ts` | UserRole type | WIRED | `import type { UserRole } from '@repo/types'` used in jwt and session callbacks |
| `apps/web/app/(ops)/layout.tsx` | `apps/web/auth.ts` | requireAuth -> auth() | WIRED | `requireAuth` in `lib/auth-guard.ts` calls `auth()` imported from `@/auth` |
| `apps/web/lib/auth-guard.ts` | `apps/web/auth.ts` | auth() | WIRED | Line 1: `import { auth } from '@/auth'` |
| `apps/web/app/(ops)/settings/actions.ts` | `packages/db/src/schema/settings.ts` | Drizzle query on systemSettings | WIRED | `import { db, systemSettings, prisonFacilities } from '@repo/db'`; queries systemSettings |
| `apps/web/app/(ops)/settings/actions.ts` | `packages/db/src/schema/tenants.ts` | Drizzle query on prisonFacilities | WIRED | Queries prisonFacilities from same import |
| `apps/web/app/(ops)/settings/actions.ts` | `apps/web/auth.ts` | auth() for reco-admin check | WIRED | `requireRecoAdmin()` calls `auth()` |
| `packages/db/src/tests/rls.test.ts` | `packages/db/src/rls.ts` | withRLSContext wrapper | WIRED | `const { withRLSContext } = await import('../rls')` |
| `.github/workflows/ci.yml` | `packages/db/src/tests/rls.test.ts` | pnpm test command | WIRED | `pnpm --filter @repo/db test` in test-rls job |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| ROUTE-01 | 01-04, 01-08 | Tenant context from subdomain without DB call | SATISFIED | middleware.ts (commit c9b0fde) activates proxy(); proxy.ts logic was already correct |
| ROUTE-02 | 01-01, 01-04, 01-05, 01-08 | Single Next.js 16 deployment serves three domain contexts | SATISFIED | Route groups (ops)/(client)/(public) exist; x-tenant-context header injection now active via middleware.ts |
| ROUTE-03 | 01-01, 01-04 | Wildcard DNS routes all client subdomains to same deployment | SATISFIED | proxy.ts handles any subdomain as `client` context; new tenant requires no code change |
| ROUTE-04 | 01-02, 01-07 | Every table has tenant_id; RLS enforces tenant isolation | SATISFIED | All tenant-scoped tables have tenant_id + restrictive deny-all RLS policy; RLS tests verify isolation |
| ROUTE-05 | 01-02, 01-07 | tenant_id index on every tenant-scoped table | SATISFIED | `users_tenant_id_idx` on users; schema test asserts index existence |
| AUTH-01 | 01-02, 01-07 | Six user roles exist | SATISFIED | `userRoleEnum` in schema/auth.ts; schema test verifies all six values |
| AUTH-02 | 01-03 | Role, tenant_id, location_id, facility_id injected into JWT | SATISFIED | jwt callback in auth.ts reads all four fields from DB user on sign-in and session update |
| AUTH-03 | 01-03 | Client portal users authenticate via magic link | SATISFIED | Resend provider configured; sign-in page presents magic link form |
| AUTH-04 | 01-03 | Ops portal users authenticate via email/magic link or Entra ID | SATISFIED | Both Entra ID and Resend providers configured |
| AUTH-05 | 01-03, 01-05 | Prison login via /prison/login?facility=X, 7-day sessions | SATISFIED | prison/login/page.tsx reads facility param, POSTs to /api/prison/send-login; session maxAge = 7 days |
| AUTH-06 | 01-03 | Auth cookies scoped to .courierrecycling.com | SATISFIED | auth.ts cookie domain set to `.courierrecycling.com` in production |
| AUTH-07 | 01-02 | client role users locked to specific location_id | SATISFIED | users table has location_id column; JWT claim injected; RLS uses location_id claim |
| AUTH-08 | 01-02, 01-06 | reco role has per-user can_view_financials toggle | SATISFIED | can_view_financials column in users table (default false); settings page enforces reco-admin access |
| AUTH-10 | 01-03, 01-07, 01-09 | service_role key never in client-side code or API routes | SATISFIED | schema.test.ts now contains real recursive filesystem scan (commit f3a5963); stub removed; CI security-check job also enforces this |
| SETTINGS-01 | 01-06 | reco-admin can configure exchange rate, thresholds | SATISFIED | general-settings-form.tsx + actions.ts implement all three fields with validation |
| SETTINGS-02 | 01-06 | Prison facility registry: name, address, email, active | SATISFIED | facilities-table.tsx + actions.ts implement full CRUD with slug, name, address, contact_email, active |

---

## Anti-Patterns Found

None remaining. Both previously flagged anti-patterns have been resolved:

- `apps/web/proxy.ts` orphaned export — RESOLVED by creation of `apps/web/middleware.ts`
- `packages/db/src/tests/schema.test.ts` stub assertion — RESOLVED by replacement with real filesystem scan

---

## Human Verification Required

### 1. Settings Page Form Behaviour

**Test:** Sign in as reco-admin, navigate to /settings. Verify exchange rate form, warehouse threshold form, and discrepancy threshold form all show current values. Make no changes and confirm Save button is disabled. Change a value and confirm Save button enables. Save and confirm success toast appears. Reload page and confirm new values persisted.
**Expected:** All described behaviours work end-to-end
**Why human:** Requires live database and authenticated session

### 2. Prison Login Magic Link Flow

**Test:** With a seeded facility record (slug e.g. `test-prison`), navigate to `/prison/login?facility=test-prison`. Click "Send login link". Check facility contact_email inbox for Auth.js magic link email. Click link and confirm session is established with `prison` role and correct `facility_id`.
**Expected:** Magic link delivered via Resend; session has prison role
**Why human:** Requires live Resend API key, seeded DB record, and email inbox access

### 3. Auth Guard Redirects

**Test:** Clear all cookies. Attempt to access `/` (which maps to (ops) route group). Confirm redirect to `/sign-in`. Sign in as a `client` role user. Attempt to access an (ops) route. Confirm redirect to `/access-denied`.
**Expected:** Correct redirects for unauthenticated and wrong-role cases
**Why human:** Requires running Next.js server with real sessions

---

_Verified: 2026-03-20T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure: plans 01-08 (middleware.ts) and 01-09 (schema.test.ts filesystem scan)_
