---
phase: 9
slug: notifications-and-manuals
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 09-01-01 | 01 | 1 | NOTIF-01 | migration | `pnpm db:migrate` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | NOTIF-01 | unit | `pnpm test --run notification` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | NOTIF-01 | integration | `pnpm test --run realtime` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | NOTIF-02 | unit | `pnpm test --run email` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 2 | NOTIF-03 | unit | `pnpm test --run mute` | ❌ W0 | ⬜ pending |
| 09-04-01 | 04 | 1 | MANUAL-01 | migration | `pnpm db:migrate` | ❌ W0 | ⬜ pending |
| 09-05-01 | 05 | 2 | MANUAL-02 | unit | `pnpm test --run manual-render` | ❌ W0 | ⬜ pending |
| 09-06-01 | 06 | 3 | MANUAL-03 | integration | `pnpm test --run manual-editor` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/web/tests/notifications/notification.test.ts` — stubs for NOTIF-01, NOTIF-02, NOTIF-03
- [ ] `packages/web/tests/manuals/manual-render.test.ts` — stubs for MANUAL-01, MANUAL-02
- [ ] `packages/web/tests/manuals/manual-editor.test.ts` — stubs for MANUAL-03, MANUAL-04
- [ ] Mock `react-markdown` in vitest setup — ESM-only package requires manual mock

*Wave 0 installs: `pnpm add react-markdown rehype-raw remark-gfm` (if not already installed)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| In-app bell icon updates in real-time | NOTIF-01 | Requires live Supabase Realtime connection | Open two browser tabs; trigger notification event; verify bell updates without refresh |
| Critical notifications unmutable | NOTIF-03 | UI assertion on absence of mute control | Log in as reco-admin; open notification centre; verify no mute toggle on critical types |
| Email delivery | NOTIF-02 | Requires Resend sandbox or real inbox | Trigger notification event; verify email received in Resend dashboard or test inbox |
| Prison manual distinct from client manual | MANUAL-02 | Content correctness check | Log in as prison role and client role separately; verify different content shown |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
