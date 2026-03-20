---
phase: 2
slug: auth-roles-and-tenant-branding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `apps/web/vitest.config.ts` / `packages/db/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test --run` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test --run`
- **After every plan wave:** Run `pnpm test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | AUTH-09 | unit | `pnpm --filter web test --run user-invite` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | AUTH-09 | unit | `pnpm --filter web test --run user-deactivate` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | BRAND-01 | unit | `pnpm --filter db test --run branding-schema` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 2 | BRAND-02,03 | unit | `pnpm --filter web test --run branding-injection` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 2 | BRAND-05 | unit | `pnpm --filter web test --run wcag-contrast` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/tests/user-invite.test.ts` — stubs for AUTH-09 invite flow
- [ ] `apps/web/tests/user-deactivate.test.ts` — stubs for AUTH-09 deactivation
- [ ] `packages/db/src/tests/branding-schema.test.ts` — stubs for BRAND-01 schema
- [ ] `apps/web/tests/branding-injection.test.ts` — stubs for BRAND-02, BRAND-03
- [ ] `apps/web/tests/wcag-contrast.test.ts` — stubs for BRAND-05 contrast validation

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prison login bookmark stability | Phase SC-4 | Requires browser cookie + 7-day session timing | Bookmark /prison/login?facility=test, visit next day, verify magic link still sends |
| Cross-subdomain session sharing | AUTH-06 (Phase 1, verify still holds) | Requires multiple subdomain DNS setup | Sign in on ops., navigate to wolt., verify session persists |
| Live branding preview updates | BRAND-02 | Visual rendering verification | Edit colour in branding tab, verify preview panel updates without save |
| Invited user email receipt | AUTH-09 | Requires real email delivery | Invite a test email, verify Resend delivers with correct link |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
