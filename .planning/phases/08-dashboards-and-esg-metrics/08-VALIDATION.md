---
phase: 8
slug: dashboards-and-esg-metrics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm test --run --reporter=verbose` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run --reporter=verbose`
- **After every plan wave:** Run `pnpm test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | ESG-01 | unit | `pnpm test --run esg-calculator` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | ESG-02 | unit | `pnpm test --run esg-calculator` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | ESG-03 | unit | `pnpm test --run esg-calculator` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | ESG-04 | manual | — | — | ⬜ pending |
| 08-02-02 | 02 | 2 | ESG-05 | integration | `pnpm test --run esg-metrics` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | ESG-06 | integration | `pnpm test --run esg-export` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 2 | ESG-07 | integration | `pnpm test --run esg-export` | ❌ W0 | ⬜ pending |
| 08-04-01 | 04 | 2 | DASH-01 | integration | `pnpm test --run reco-dashboard` | ❌ W0 | ⬜ pending |
| 08-05-01 | 05 | 2 | DASH-02 | integration | `pnpm test --run client-dashboard` | ❌ W0 | ⬜ pending |
| 08-06-01 | 06 | 2 | DASH-03 | integration | `pnpm test --run transport-dashboard` | ❌ W0 | ⬜ pending |
| 08-07-01 | 07 | 3 | DASH-04 | performance | `pnpm test --run dashboard-perf` | ❌ W0 | ⬜ pending |
| 08-07-02 | 07 | 3 | DASH-05 | performance | `pnpm test --run dashboard-perf` | ❌ W0 | ⬜ pending |
| 08-07-03 | 07 | 3 | DASH-06 | performance | `pnpm test --run dashboard-perf` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/lib/esg-calculator.test.ts` — unit test stubs for ESG-01, ESG-02, ESG-03 (temporal join, material aggregation, anchor values with exact kg values: 943 polypropylene, 386 PVC, 294 polyester per 1,000 bike bags)

*Note: DASH-01 through DASH-05 and ESG-04/ESG-06/ESG-07 integration tests are manual-only (confirmed in RESEARCH.md). No additional Wave 0 stubs required. The esg-calculator.test.ts file is created in plan 08-01 Task 1 (TDD RED phase).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CO2 avoided formula displays as "pending formula" stub | ESG-04 | Formula not yet confirmed by reco/Wolt; automated test would assert wrong value | Visually confirm ESG metrics page shows formula_pending notice for CO2 avoided |
| PDF renders correctly in browser | ESG-06 | @react-pdf/renderer PDF output requires visual inspection | Download the PDF export and open in browser; verify layout, material table, methodology section present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
