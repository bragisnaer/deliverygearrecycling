---
phase: 7
slug: financial-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing, from Phase 1) |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `pnpm test --run --reporter=verbose` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run --reporter=verbose`
- **After every plan wave:** Run `pnpm test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 07-01 | 1 | FIN-01 | unit | `pnpm test --run financial-record` | ❌ W0 | ⬜ pending |
| 7-01-02 | 07-01 | 1 | FIN-01 | unit | `pnpm test --run financial-record` | ❌ W0 | ⬜ pending |
| 7-02-01 | 07-02 | 1 | FIN-02 | unit | `pnpm test --run invoice-calculation` | ❌ W0 | ⬜ pending |
| 7-02-02 | 07-02 | 1 | FIN-02 | unit | `pnpm test --run invoice-calculation` | ❌ W0 | ⬜ pending |
| 7-03-01 | 07-03 | 2 | FIN-03 | manual | — | — | ⬜ pending |
| 7-03-02 | 07-03 | 2 | FIN-04 | unit | `pnpm test --run role-visibility` | ❌ W0 | ⬜ pending |
| 7-04-01 | 07-04 | 2 | FIN-03 | unit | `pnpm test --run uninvoiced-alert` | ❌ W0 | ⬜ pending |
| 7-05-01 | 07-05 | 2 | FIN-05 | unit | `pnpm test --run currency-display` | ❌ W0 | ⬜ pending |
| 7-05-02 | 07-05 | 2 | FIN-06 | manual | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/web/tests/financial-record.test.ts` — stubs for FIN-01 (schema auto-creation, RLS)
- [ ] `packages/web/tests/invoice-calculation.test.ts` — stubs for FIN-02 (two-leg cost, pricing)
- [ ] `packages/web/tests/role-visibility.test.ts` — stubs for FIN-04 (can_view_financials gate)
- [ ] `packages/web/tests/uninvoiced-alert.test.ts` — stubs for FIN-03 (14-day threshold, revenue estimate)
- [ ] `packages/web/tests/currency-display.test.ts` — stubs for FIN-05 (EUR/DKK conversion)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Invoice management UI (edit status, number, date, notes) | FIN-03 | React form interaction requires browser | Open a delivered intake → edit invoice fields → verify save |
| Currency toggle persists across page reload | FIN-06 | Cookie persistence requires browser | Toggle DKK → reload → verify amounts still in DKK |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
