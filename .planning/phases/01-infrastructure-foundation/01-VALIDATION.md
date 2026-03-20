---
phase: 1
slug: infrastructure-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 |
| **Config file** | `packages/db/vitest.config.ts` — does not exist yet (Wave 0 gap) |
| **Quick run command** | `pnpm --filter @repo/db test:rls` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds (RLS integration tests hit real DB) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @repo/db test:rls` (~5s, RLS isolation only)
- **After every plan wave:** Run `pnpm test` (full monorepo suite)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-xx | 01-01 | 1 | ROUTE-01/02 | unit | `pnpm --filter @repo/web test -- proxy` | ❌ W0 | ⬜ pending |
| 1-02-xx | 01-02 | 1 | ROUTE-04 | integration | `pnpm --filter @repo/db test -- rls` | ❌ W0 | ⬜ pending |
| 1-02-xx | 01-02 | 1 | ROUTE-05 | schema | `pnpm --filter @repo/db test -- schema` | ❌ W0 | ⬜ pending |
| 1-02-xx | 01-02 | 1 | AUTH-01 | unit | `pnpm --filter @repo/db test -- roles` | ❌ W0 | ⬜ pending |
| 1-03-xx | 01-03 | 2 | AUTH-02 | unit | `pnpm --filter @repo/web test -- jwt-callback` | ❌ W0 | ⬜ pending |
| 1-04-xx | 01-04 | 2 | AUTH-06 | unit | `pnpm --filter @repo/web test -- cookie-domain` | ❌ W0 | ⬜ pending |
| 1-04-xx | 01-04 | 2 | ROUTE-01 | unit | `pnpm --filter @repo/web test -- proxy` | ❌ W0 | ⬜ pending |
| 1-06-xx | 01-06 | 3 | SETTINGS-01 | integration | `pnpm --filter @repo/web test -- settings` | ❌ W0 | ⬜ pending |
| 1-06-xx | 01-06 | 3 | SETTINGS-02 | integration | `pnpm --filter @repo/web test -- facilities` | ❌ W0 | ⬜ pending |
| 1-07-xx | 01-07 | 3 | AUTH-10 | static | `biome check apps/web/app/api` | N/A — lint | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/db/vitest.config.ts` — Vitest config pointing at test database
- [ ] `packages/db/src/tests/rls.test.ts` — RLS isolation test stubs (ROUTE-04 success criterion)
- [ ] `packages/db/src/tests/schema.test.ts` — tenant_id index assertion stubs
- [ ] `apps/web/src/tests/proxy.test.ts` — proxy.ts unit test using `unstable_doesProxyMatch`
- [ ] `apps/web/src/tests/auth-callbacks.test.ts` — JWT callback unit test stubs
- [ ] `.env.test` — `DATABASE_URL_TEST` pointing at isolated Azure PostgreSQL test database

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prison magic link login at `/prison/login?facility=X` | AUTH-05 | Requires real email delivery (Resend) and browser session | 1. Navigate to `/prison/login?facility=test`. 2. Enter facility email. 3. Check inbox for magic link. 4. Click link — session must persist 7 days. |
| Cross-subdomain session sharing | AUTH-06 | Requires real wildcard DNS or /etc/hosts override | 1. Log in at `wolt.localhost`. 2. Navigate to `ops.localhost`. 3. Confirm still authenticated (no redirect to login). |
| Entra ID SSO login for reco staff | AUTH-03/04 | Requires live Azure AD app registration | 1. Click "Sign in with Microsoft". 2. Use reco staff account. 3. Confirm redirected to ops dashboard with correct role. |
| reco-admin system settings configure and persist | SETTINGS-01 | UI smoke test | 1. Log in as reco-admin. 2. Navigate to /settings. 3. Change exchange rate. 4. Click Save. 5. Refresh — confirm value persists. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
