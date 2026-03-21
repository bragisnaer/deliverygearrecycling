---
phase: 09-notifications-and-manuals
plan: "00"
subsystem: test-infrastructure
tags: [vitest, react-markdown, esm-mock, test-stubs, wave-0]
dependency_graph:
  requires: []
  provides:
    - apps/web/lib/notifications.test.ts
    - apps/web/components/manual-renderer.test.ts
    - apps/web/app/(ops)/manual-editor/actions.test.ts
    - apps/web/__mocks__/react-markdown.ts
    - apps/web/__mocks__/remark-gfm.ts
    - apps/web/__mocks__/rehype-raw.ts
  affects:
    - apps/web/vitest.config.ts
tech_stack:
  added:
    - react-markdown@10.1.0
    - rehype-raw@7.0.0
    - remark-gfm@4.0.1
  patterns:
    - Vitest alias array for ESM-only packages (specific before generic)
    - it.todo() stubs for Wave 0 Nyquist compliance
key_files:
  created:
    - apps/web/__mocks__/react-markdown.ts
    - apps/web/__mocks__/remark-gfm.ts
    - apps/web/__mocks__/rehype-raw.ts
    - apps/web/lib/notifications.test.ts
    - apps/web/components/manual-renderer.test.ts
    - apps/web/app/(ops)/manual-editor/actions.test.ts
  modified:
    - apps/web/vitest.config.ts
    - apps/web/package.json
decisions:
  - "react-markdown ESM mock uses React.createElement to avoid JSX transform dependency in Vitest Node env"
  - "remark-gfm and rehype-raw mocked as no-op functions since plugins are not exercised in unit tests"
  - "manual-editor directory created ahead of Plan 04 implementation to host the stub file"
metrics:
  duration: 2 minutes
  completed: "2026-03-21"
  tasks_completed: 2
  files_changed: 8
---

# Phase 09 Plan 00: Wave 0 Test Stubs and ESM Mock Configuration Summary

Wave 0 setup creating react-markdown ESM mock aliases in Vitest and three it.todo() stub files so all Wave 1+ verify commands have valid test file targets without failures.

## What Was Built

### Task 1: react-markdown ESM mock and Vitest configuration
- Installed react-markdown@10.1.0, rehype-raw@7.0.0, remark-gfm@4.0.1 into `@repo/web`
- Created `__mocks__/react-markdown.ts` — renders a `<div data-testid="mock-markdown">` wrapper; avoids ESM-only package import failure in Vitest's Node environment
- Created `__mocks__/remark-gfm.ts` and `__mocks__/rehype-raw.ts` — no-op plugin stubs
- Added three alias entries in `vitest.config.ts` before the generic `@` alias so Vite first-match resolution routes react-markdown imports to the mock

### Task 2: Wave 0 test stubs
- `lib/notifications.test.ts` — 11 todos covering CRITICAL_NOTIFICATION_TYPES, NON_CRITICAL_NOTIFICATION_TYPES, isCritical(), and saveMutePreference guard (NOTIF-01/02/03)
- `components/manual-renderer.test.ts` — 4 todos for ManualRenderer markdown, GFM tables, images, and raw HTML pass-through (MANUAL-01/02)
- `app/(ops)/manual-editor/actions.test.ts` — 8 todos for saveManualPage versioning, slug validation, getManualPage, togglePublish, and context isolation (MANUAL-03/04)

## Verification

- `pnpm --filter @repo/web test --run`: **15 passed, 5 skipped** — 117 tests pass, 34 todos pending (none failing)
- react-markdown present in apps/web/package.json
- vitest.config.ts contains react-markdown, remark-gfm, rehype-raw aliases
- All three stub files exist at expected paths

## Commits

| Hash | Message |
|------|---------|
| 387523e | chore(09-00): install react-markdown and configure ESM mocks in Vitest |
| 9c67ae7 | test(09-00): add Wave 0 test stubs for notifications and manuals |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Created manual-editor directory**
- **Found during:** Task 2
- **Issue:** `app/(ops)/manual-editor/` did not exist; the test stub file could not be placed without the directory
- **Fix:** Created the directory ahead of Plan 04 which will add the actual route files
- **Files modified:** `app/(ops)/manual-editor/` (new directory)
- **Commit:** 9c67ae7

## Known Stubs

All three test files are intentionally entirely composed of `it.todo()` stubs. This is Wave 0 — the stubs exist for Nyquist compliance only. Wave 1+ plans replace the todos with real test bodies.

## Self-Check: PASSED

- `apps/web/__mocks__/react-markdown.ts` — FOUND
- `apps/web/__mocks__/remark-gfm.ts` — FOUND
- `apps/web/__mocks__/rehype-raw.ts` — FOUND
- `apps/web/lib/notifications.test.ts` — FOUND
- `apps/web/components/manual-renderer.test.ts` — FOUND
- `apps/web/app/(ops)/manual-editor/actions.test.ts` — FOUND
- Commit 387523e — FOUND
- Commit 9c67ae7 — FOUND
