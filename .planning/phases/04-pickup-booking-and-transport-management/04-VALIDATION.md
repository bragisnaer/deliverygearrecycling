---
phase: 4
slug: pickup-booking-and-transport-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.1.0 |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test` |
| **Full suite command** | `pnpm --filter web test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test`
- **After every plan wave:** Run `pnpm --filter web test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-02-01 | 02 | 0 | PICKUP-02 | unit (mock DB) | `pnpm --filter web test -- --grep "pickup reference"` | ❌ Wave 0 | ⬜ pending |
| 04-02-02 | 02 | 0 | PICKUP-04 | unit (mock DB) | `pnpm --filter web test -- --grep "72-hour"` | ❌ Wave 0 | ⬜ pending |
| 04-03-01 | 03 | 0 | PICKUP-06 | unit (mock DB) | `pnpm --filter web test -- --grep "cancellation"` | ❌ Wave 0 | ⬜ pending |
| 04-08-01 | 08 | 0 | TRANS-07 | unit (pure fn) | `pnpm --filter web test -- --grep "pro-rata"` | ❌ Wave 0 | ⬜ pending |
| 04-08-02 | 08 | 0 | TRANS-10 | unit (mock DB) | `pnpm --filter web test -- --grep "cascade"` | ❌ Wave 0 | ⬜ pending |
| 04-10-01 | 10 | 0 | PICKUP-08 | unit (mock Resend) | `pnpm --filter web test -- --grep "confirmation email"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/app/(client)/pickups/actions.test.ts` — stubs for PICKUP-02, PICKUP-04, PICKUP-06
- [ ] `apps/web/app/(ops)/pickups/actions.test.ts` — stubs for PICKUP-07, TRANS-10
- [ ] `apps/web/app/(ops)/transport/actions.test.ts` — stubs for TRANS-07 pro-rata logic
- [ ] Resend mock: `vi.mock('resend', ...)` in test files (same pattern as storage mock in Phase 3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Client booking form renders correct product list for tenant | PICKUP-01 | Requires seeded DB + browser | Log in as client, navigate to /pickups/new, verify products match tenant registry |
| Photo upload drag-and-drop and file picker work | PICKUP-01 | Browser interaction | Test drag-and-drop and click-to-pick on booking form |
| Date picker disables dates within 72h | PICKUP-04 | Browser interaction | Attempt to select today+1 — should be disabled |
| Colour-coded ageing indicator turns red at threshold | TRANS-09 | Requires seeded data | Seed a pickup held 15+ days, verify red highlight in warehouse inventory |
| Pro-rata allocation breakdown shows before confirming outbound shipment | TRANS-07 | Browser interaction | Create outbound shipment with 2 pickups, verify breakdown table appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
