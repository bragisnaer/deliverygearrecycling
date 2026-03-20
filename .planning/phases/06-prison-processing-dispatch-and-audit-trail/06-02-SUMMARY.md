---
phase: 06-prison-processing-dispatch-and-audit-trail
plan: "02"
subsystem: audit-trail
tags: [audit, edit-actions, prison, reco-admin, components]
dependency_graph:
  requires: ["06-01"]
  provides: ["editIntakeRecord", "editProcessingReport", "editIntakeRecordAdmin", "editProcessingReportAdmin", "getEditHistory", "EditedIndicator", "EditHistoryModal"]
  affects: ["06-03", "06-04", "06-05"]
tech_stack:
  added: []
  patterns:
    - "48-hour edit time lock via Date.now() - created_at.getTime() > LOCK_MS"
    - "raw db (no RLS) for audit_log queries — Pitfall 6 pattern"
    - "UPDATE-only filter in getEditHistory — INSERT/DELETE are not edits"
    - "computeFieldDiff from audit-helpers for field-level diff rendering"
key_files:
  created:
    - apps/web/app/(ops)/processing/actions.ts
    - apps/web/components/edited-indicator.tsx
    - apps/web/components/edit-history-modal.tsx
  modified:
    - apps/web/app/prison/actions.ts
    - apps/web/app/(ops)/intake/actions.ts
    - apps/web/messages/da.json
decisions:
  - "EditedIndicator receives isEdited: boolean as prop (not AuditEntry[]) — keeps component pure and avoids passing raw audit data to client; re-exports isRecordEdited for consumer convenience"
  - "EditHistoryModal uses existing Dialog wrapper (base-ui/react/dialog) — already installed in codebase"
  - "getEditHistory placed in (ops)/intake/actions.ts — reusable for both intake records and processing reports via tableName param"
metrics:
  duration_seconds: 270
  completed_date: "2026-03-20T21:44:13Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 06 Plan 02: Edit-in-Place with Audit Trail Summary

One-liner: Role-gated edit Server Actions with 48-hour prison lock, admin bypass, and reusable EditedIndicator and EditHistoryModal components backed by audit_log field-level diffs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Edit Server Actions for intake and processing with 48-hour lock and admin bypass | e075792 | apps/web/app/prison/actions.ts, apps/web/app/(ops)/intake/actions.ts, apps/web/app/(ops)/processing/actions.ts |
| 2 | EditedIndicator and EditHistoryModal components | c7685f6 | apps/web/components/edited-indicator.tsx, apps/web/components/edit-history-modal.tsx, apps/web/messages/da.json |

## What Was Built

**Server Actions (Task 1):**

- `editIntakeRecord` in `apps/web/app/prison/actions.ts` — prison role can edit intake records within 48 hours of `created_at`; returns `{ error: 'edit_locked' }` after 48 hours
- `editProcessingReport` in `apps/web/app/prison/actions.ts` — same 48-hour lock for processing reports (AUDIT-02)
- `editIntakeRecordAdmin` in `apps/web/app/(ops)/intake/actions.ts` — reco-admin can edit intake records at any time with no time restriction (AUDIT-03)
- `editProcessingReportAdmin` in `apps/web/app/(ops)/processing/actions.ts` — reco-admin can edit processing reports at any time (AUDIT-02/03)
- `getEditHistory(tableName, recordId)` in `apps/web/app/(ops)/intake/actions.ts` — queries `audit_log` via raw `db` (no RLS), filters to `action = 'UPDATE'` only

**UI Components (Task 2):**

- `EditedIndicator` — renders a `Badge` with `Pencil` icon only when `isEdited=true`; returns `null` otherwise; calls `onViewHistory` callback on click; re-exports `isRecordEdited` from `audit-helpers`
- `EditHistoryModal` — wraps existing Dialog; maps each audit entry through `computeFieldDiff`; renders table of Field | Old Value | New Value | Changed By | Changed At; Danish empty state "Ingen redigeringshistorik"
- `messages/da.json` — added `audit` namespace with 9 keys: `edited`, `edit_history`, `no_edits`, `field`, `old_value`, `new_value`, `changed_by`, `changed_at`, `edit_locked`

## Verification

- Prison edit returns `edit_locked` for intake records > 48 hours old: PASS (LOCK_MS check in editIntakeRecord)
- Prison edit returns `edit_locked` for processing reports > 48 hours old: PASS (LOCK_MS check in editProcessingReport)
- Admin edit has no time restriction for either record type: PASS (no LOCK_MS check in admin actions)
- EditedIndicator renders only when isEdited=true, null otherwise: PASS
- EditHistoryModal shows field-level diffs via computeFieldDiff: PASS
- Danish translations added: PASS

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components are fully wired. EditedIndicator and EditHistoryModal are complete reusable components ready to be dropped into intake, processing, and dispatch detail pages.

## Self-Check: PASSED

- apps/web/app/prison/actions.ts: FOUND (contains editIntakeRecord + editProcessingReport)
- apps/web/app/(ops)/intake/actions.ts: FOUND (contains editIntakeRecordAdmin + getEditHistory)
- apps/web/app/(ops)/processing/actions.ts: FOUND (contains editProcessingReportAdmin)
- apps/web/components/edited-indicator.tsx: FOUND
- apps/web/components/edit-history-modal.tsx: FOUND
- Commits e075792 and c7685f6: FOUND
