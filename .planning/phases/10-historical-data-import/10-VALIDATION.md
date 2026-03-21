---
phase: 10
slug: historical-data-import
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-21
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm test --run` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run`
- **After every plan wave:** Run `pnpm test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | IMPORT-01 | migration | `pnpm db:push && pnpm test --run` | ✅ | ⬜ pending |
| 10-01-02 | 01 | 1 | IMPORT-01 | unit | `cd apps/web && pnpm vitest run lib/import-parser.test.ts` | ✅ TDD | ⬜ pending |
| 10-02-01 | 02 | 1 | IMPORT-01 | unit | `pnpm test --run` | ✅ | ⬜ pending |
| 10-02-02 | 02 | 1 | IMPORT-02 | unit | `cd apps/web && pnpm vitest run lib/import-validators.test.ts` | ✅ TDD | ⬜ pending |
| 10-03-01 | 03 | 2 | IMPORT-02 | integration | `pnpm test --run` | ✅ | ⬜ pending |
| 10-03-02 | 03 | 2 | IMPORT-02 | integration | `pnpm test --run` | ✅ | ⬜ pending |
| 10-03-03 | 03 | 2 | IMPORT-02 | integration | `pnpm test --run` | ✅ | ⬜ pending |
| 10-04-01 | 04 | 2 | IMPORT-03 | integration | `pnpm test --run` | ✅ | ⬜ pending |
| 10-04-02 | 04 | 2 | IMPORT-03 | integration | `pnpm test --run` | ✅ | ⬜ pending |
| 10-05-01 | 05 | 3 | ALL | regression | `pnpm --filter @apps/web vitest run && pnpm --filter @apps/web tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending | ✅ green | ❌ red | ⚠ flaky*

---

## Wave 0 Requirements

No Wave 0 stubs needed. Plans 01 and 02 use inline TDD (test files created alongside implementation within the same task). Test file paths:

- `apps/web/lib/import-parser.test.ts` — created by Plan 01, Task 2 (TDD)
- `apps/web/lib/import-validators.test.ts` — created by Plan 02, Task 2 (TDD)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Column mapping UI renders correctly | IMPORT-01 | Visual browser interaction | Upload a CSV, verify dropdown column mapping works |
| Import source badge visible in list views | IMPORT-03 | Visual browser inspection | After import, verify badge shows in pickup log, intake log list views |
| ESG totals include historical data | IMPORT-04 | Requires real imported data | Import sample data, check ESG dashboard totals update |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or inline TDD
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 not needed (inline TDD covers test creation)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
