---
phase: 10
slug: historical-data-import
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 10-01-02 | 01 | 1 | IMPORT-01 | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | IMPORT-01 | integration | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | IMPORT-02 | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | IMPORT-02 | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 2 | IMPORT-02 | integration | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 10-04-01 | 04 | 3 | IMPORT-03 | integration | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 10-04-02 | 04 | 3 | IMPORT-04 | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |
| 10-05-01 | 05 | 3 | IMPORT-03 | unit | `pnpm test --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/web/src/app/api/import/__tests__/import.test.ts` — stubs for IMPORT-01, IMPORT-02
- [ ] `packages/web/src/lib/import/__tests__/parsers.test.ts` — CSV/XLSX parsing unit tests
- [ ] `packages/web/src/lib/import/__tests__/validators.test.ts` — field validation unit tests
- [ ] `packages/web/src/lib/import/__tests__/commit.test.ts` — bulk upsert and rollback tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Column mapping UI renders correctly | IMPORT-01 | Visual browser interaction | Upload a CSV, verify drag-drop column mapping works |
| Import source badge visible in list views | IMPORT-03 | Visual browser inspection | After import, verify badge shows in pickup log, intake log list views |
| ESG totals include historical data | IMPORT-04 | Requires real imported data | Import sample data, check ESG dashboard totals update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
