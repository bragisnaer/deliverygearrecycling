---
phase: 5
slug: prison-intake-and-counting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.1.0 |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @repo/web test` |
| **Full suite command** | `pnpm --filter @repo/web test && pnpm --filter @repo/db test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @repo/web test`
- **After every plan wave:** Run `pnpm --filter @repo/web test && pnpm --filter @repo/db test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 1 | INTAKE-01 | unit | `pnpm --filter @repo/web test -- --grep "requirePrisonSession"` | ❌ Wave 0 | ⬜ pending |
| 5-03-01 | 03 | 2 | INTAKE-03 | unit | `pnpm --filter @repo/web test -- --grep "submitIntake"` | ❌ Wave 0 | ⬜ pending |
| 5-04-01 | 04 | 2 | INTAKE-04 | unit | `pnpm --filter @repo/web test -- --grep "getExpectedDelivery"` | ❌ Wave 0 | ⬜ pending |
| 5-05-01 | 05 | 2 | INTAKE-05 | unit | `pnpm --filter @repo/web test -- --grep "submitUnexpectedIntake"` | ❌ Wave 0 | ⬜ pending |
| 5-06-01 | 06 | 3 | INTAKE-06 | unit | `pnpm --filter @repo/web test -- --grep "discrepancy"` | ❌ Wave 0 | ⬜ pending |
| 5-06-02 | 06 | 3 | INTAKE-06 | unit | `pnpm --filter @repo/web test -- --grep "calculateDiscrepancyPct"` | ❌ Wave 0 | ⬜ pending |
| 5-07-01 | 07 | 3 | INTAKE-07 | unit | `pnpm --filter @repo/web test -- --grep "quarantine"` | ❌ Wave 0 | ⬜ pending |
| 5-07-02 | 07 | 3 | INTAKE-07 | unit | `pnpm --filter @repo/web test -- --grep "overrideQuarantine"` | ❌ Wave 0 | ⬜ pending |
| 5-08-01 | 08 | 4 | INTAKE-08 | unit | `pnpm --filter @repo/web test -- --grep "persistent.*flag\|persistentFlag"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/app/prison/actions.test.ts` — stubs for INTAKE-01, INTAKE-03, INTAKE-04, INTAKE-05, INTAKE-06, INTAKE-07
- [ ] `apps/web/app/(ops)/intake/actions.test.ts` — stubs for INTAKE-07 quarantine override
- [ ] `apps/web/lib/discrepancy.test.ts` — stubs for `calculateDiscrepancyPct` pure function (INTAKE-06 boundary cases)
- [ ] `apps/web/lib/persistent-flag.test.ts` — stubs for persistent problem market logic (INTAKE-08)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Prison tablet 2-tap navigation flow | INTAKE-01 | Visual/UX verification of tap count | Open prison portal, confirm home → deliveries list → form in 2 taps |
| Danish language labels rendered correctly | INTAKE-02 | Requires visual confirmation of i18n strings | Load prison intake page, verify all labels are Danish |
| Discrepancy warning shown inline before submit | INTAKE-06 | Visual UI state verification | Enter quantity exceeding threshold, confirm yellow warning appears per row |
| Quarantine block prevents form submission | INTAKE-07 | End-to-end flow requires real or seeded batch_flags data | Enter a batch number matching a batch_flags entry, confirm submit is blocked |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
