---
phase: 06-prison-processing-dispatch-and-audit-trail
plan: 03
subsystem: audit
tags: [void, audit-trail, server-actions, react, dialog, drizzle, vitest, danish]

requires:
  - phase: 06-01
    provides: intakeRecords schema with voided/void_reason columns and reco-admin RLS policies

provides:
  - validateVoidInput pure helper — tested, reusable across all record types
  - voidIntakeRecord Server Action — reco-admin only, checks already_voided, reason required
  - Voided-record exclusion filter on getIntakeQueue and getQuarantinedIntakes
  - VoidRecordDialog reusable React component — reason textarea, inline errors, loading state
  - Danish translations for void namespace in da.json

affects:
  - 06-04 processing void action (can reuse validateVoidInput + VoidRecordDialog)
  - 06-05 dispatch void action (same pattern)
  - 06-08 audit log viewer (voided records remain visible)

tech-stack:
  added: []
  patterns:
    - validateVoidInput pure helper pattern — zero-dependency validation, fully unit-tested, imported by server actions
    - VoidRecordDialog generic callback pattern — onVoid(reason) => Promise<{success?, error?}> decouples component from specific action
    - voided=false filter on all list queries — prevents voided records from appearing in operational views

key-files:
  created:
    - apps/web/lib/void-helpers.ts
    - apps/web/lib/void-helpers.test.ts
    - apps/web/components/void-record-dialog.tsx
  modified:
    - apps/web/app/(ops)/intake/actions.ts
    - apps/web/messages/da.json

key-decisions:
  - "validateVoidInput returns { valid, error? } not throws — consistent with overrideQuarantine pattern in same file"
  - "VoidRecordDialog uses Dialog from @base-ui/react/dialog wrapper (components/ui/dialog.tsx) — not Radix UI"
  - "voided=false filter added to baseQuery in getIntakeQueue AND to each filtered variant — prevents double-filter logic bugs"
  - "voidIntakeRecord calls revalidatePath('/intake') after successful void — matches overrideQuarantine pattern"

patterns-established:
  - "Void pattern: validateVoidInput(reason) → check record exists → check already_voided → update set {voided:true, void_reason, updated_at}"
  - "Generic dialog pattern: onVoid callback + onClose callback + open bool — reuse for processing and dispatch detail pages"

requirements-completed:
  - AUDIT-04

duration: 3min
completed: 2026-03-20
---

# Phase 06 Plan 03: Void Policy — Helper, Server Action, and Reusable Dialog Summary

**validateVoidInput pure helper with 7 unit tests, voidIntakeRecord Server Action gated to reco-admin, and VoidRecordDialog component with Danish translations — void pattern reusable across intake, processing, and dispatch**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-20T21:48:00Z
- **Completed:** 2026-03-20T21:51:24Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `validateVoidInput` pure helper with full unit test coverage (7 tests, all passing)
- `voidIntakeRecord` Server Action: reco-admin only, reason validation, already-voided guard, DB update, cache revalidation
- `voided = false` filter added to `getIntakeQueue` and `getQuarantinedIntakes` — voided records excluded from all operational views
- `VoidRecordDialog` reusable component: reason textarea, inline error display, loading state, Danish labels inline + translation file
- `void` namespace added to `messages/da.json` with all 8 required keys

## Task Commits

1. **Task 1: Generic voidRecord helper and voidIntakeRecord Server Action** - `4354f49` (feat + test)
2. **Task 2: VoidRecordDialog reusable component** - `b596bb3` (feat)

**Plan metadata:** (docs commit below)

_Note: Task 1 used TDD — test file written first (RED), then implementation (GREEN). All 7 tests pass._

## Files Created/Modified

- `apps/web/lib/void-helpers.ts` — `validateVoidInput` pure helper: returns `{ valid, error? }` for reason validation
- `apps/web/lib/void-helpers.test.ts` — 7 unit tests covering empty, null, whitespace, and valid reason cases
- `apps/web/app/(ops)/intake/actions.ts` — Added `voidIntakeRecord` Server Action; added `voided=false` to `getIntakeQueue` and `getQuarantinedIntakes`
- `apps/web/components/void-record-dialog.tsx` — Reusable `VoidRecordDialog` with `onVoid(reason)` callback pattern
- `apps/web/messages/da.json` — Added `void` namespace: title, reason_label, reason_placeholder, confirm, cancel, reason_required, already_voided, success

## Decisions Made

- `validateVoidInput` returns `{ valid, error? }` shape (not throws) — consistent with `overrideQuarantine` in same file which returns `{ error: string }` on validation failure
- `VoidRecordDialog` uses the codebase's `@base-ui/react/dialog` wrapper in `components/ui/dialog.tsx` — Radix UI not installed
- `voided=false` filter added to both the base query AND each filter branch in `getIntakeQueue` (defensive) — prevents any variant from accidentally returning voided records
- Danish labels are hardcoded inline in the component as well as in `da.json` — component is usable without `useTranslations` context (e.g., in ops pages that don't use next-intl)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Void pattern established and ready for Plan 04 (processing) and Plan 05 (dispatch) to reuse `validateVoidInput` and `VoidRecordDialog`
- `VoidRecordDialog` accepts any `onVoid` callback — plug in `voidProcessingRecord` or `voidDispatchRecord` without modifying the component

---
*Phase: 06-prison-processing-dispatch-and-audit-trail*
*Completed: 2026-03-20*

## Self-Check: PASSED

All created files present on disk. All task commits verified in git log.
