---
phase: 6
slug: prison-processing-dispatch-and-audit-trail
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | apps/web/vitest.config.ts |
| **Quick run command** | `npx vitest run lib/ app/prison/ app/(ops)/intake/ --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run lib/ app/prison/ app/(ops)/intake/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | AUDIT-01, AUDIT-06 | migration | `test -f packages/db/migrations/0005_processing_audit.sql` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | AUDIT-04 | unit | `npx vitest run lib/audit.test.ts` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 2 | AUDIT-01, AUDIT-02, AUDIT-05 | unit | `npx vitest run app/prison/actions.test.ts` | ✅ | ⬜ pending |
| 06-03-01 | 03 | 2 | AUDIT-04 | unit | `npx vitest run app/(ops)/intake/actions.test.ts` | ✅ | ⬜ pending |
| 06-04-01 | 04 | 1 | PROCESS-02 | migration | `test -f packages/db/src/schema/processing.ts` | ❌ W0 | ⬜ pending |
| 06-05-01 | 05 | 2 | PROCESS-01, PROCESS-04 | manual | n/a | n/a | ⬜ pending |
| 06-06-01 | 06 | 3 | PROCESS-03 | unit | `npx vitest run app/(ops)/processing/actions.test.ts` | ❌ W0 | ⬜ pending |
| 06-07-01 | 07 | 1 | DISPATCH-01, DISPATCH-02, DISPATCH-03 | migration | `test -f packages/db/src/schema/dispatch.ts` | ❌ W0 | ⬜ pending |
| 06-08-01 | 08 | 3 | DISPATCH-04 | manual | n/a | n/a | ⬜ pending |
| 06-09-01 | 09 | 3 | PROCESS-05 | unit | `npx vitest run app/(ops)/traceability/actions.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/lib/audit.test.ts` — stubs for AUDIT-04 (void exclusion helper)
- [ ] `apps/web/app/(ops)/processing/actions.test.ts` — stubs for PROCESS-03 (pipeline view)
- [ ] `apps/web/app/(ops)/traceability/actions.test.ts` — stubs for PROCESS-05 (traceability chain)
- [ ] `packages/db/src/schema/processing.ts` — schema file must exist after Wave 1

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Two-tap access to Wash/Pack forms on prison tablet | PROCESS-01 | Touch target feel and tap count requires browser | Navigate to /prison as prison role; verify home screen has CTA for processing; confirm form reachable in ≤2 taps |
| Danish labels on processing forms | PROCESS-04 | Visual language verification | Open processing form on prison tablet viewport; verify all labels are Danish |
| Dispatch history visible to prison staff (read-only) | DISPATCH-04 | Role-scoped UI state | Login as prison role; confirm dispatch list loads but no create button visible |
| Edited indicator on modified records | AUDIT-05 | Visual indicator requires browser | Edit an intake record; confirm "Edited" badge appears in record detail view |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
