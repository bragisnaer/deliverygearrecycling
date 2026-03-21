---
phase: 9
slug: notifications-and-manuals
status: draft
nyquist_compliant: true
wave_0_complete: false
wave_0_plan: 09-00-PLAN.md
created: 2026-03-21
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `pnpm test --run` |
| **Full suite command** | `pnpm test --run --coverage` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --run`
- **After every plan wave:** Run `pnpm test --run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-00-01 | 00 | 0 | ALL | setup | `pnpm test --run` | Created by 09-00 | ⬜ pending |
| 09-01-01 | 01 | 1 | NOTIF-01 | migration | `pnpm db:migrate` | N/A | ⬜ pending |
| 09-01-02 | 01 | 1 | NOTIF-01 | unit | `pnpm --filter @repo/web test --run notifications` | ⬜ W0 -> 09-00 | ⬜ pending |
| 09-02-01 | 02 | 1 | NOTIF-04 | typecheck | `npx tsc --noEmit` | N/A | ⬜ pending |
| 09-03-01 | 03 | 2 | NOTIF-03 | typecheck | `npx tsc --noEmit` | N/A | ⬜ pending |
| 09-04-01 | 04 | 2 | MANUAL-03 | unit | `pnpm --filter @repo/web test --run manual-editor` | ⬜ W0 -> 09-00 | ⬜ pending |
| 09-05-01 | 05 | 2 | MANUAL-01 | unit | `pnpm --filter @repo/web test --run manual-render` | ⬜ W0 -> 09-00 | ⬜ pending |
| 09-06-01 | 06 | 3 | NOTIF-01 | typecheck | `npx tsc --noEmit` | N/A | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 is now covered by **09-00-PLAN.md** (Wave 0 plan). It creates:

- [x] `apps/web/lib/notifications.test.ts` — stubs for NOTIF-01, NOTIF-02, NOTIF-03 (co-located with source)
- [x] `apps/web/components/manual-renderer.test.ts` — stubs for MANUAL-01, MANUAL-02
- [x] `apps/web/app/(ops)/manual-editor/actions.test.ts` — stubs for MANUAL-03, MANUAL-04
- [x] Mock `react-markdown` in vitest.config.ts — ESM-only package alias mock
- [x] Install `react-markdown`, `rehype-raw`, `remark-gfm`

*Wave 0 plan: 09-00-PLAN.md (must complete before Wave 1)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-app bell icon updates in real-time | NOTIF-01 | Requires live Supabase Realtime connection | Open two browser tabs; trigger notification event; verify bell updates without refresh |
| Critical notifications unmutable | NOTIF-03 | UI assertion on absence of mute control | Log in as reco-admin; open notification centre; verify no mute toggle on critical types |
| Email delivery | NOTIF-02 | Requires Resend sandbox or real inbox | Trigger notification event; verify email received in Resend dashboard or test inbox |
| Prison manual distinct from client manual | MANUAL-02 | Content correctness check | Log in as prison role and client role separately; verify different content shown |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (via 09-00-PLAN.md)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (will be set after 09-00 execution confirms stubs pass)
