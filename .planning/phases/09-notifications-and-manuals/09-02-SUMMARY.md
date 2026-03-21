---
phase: 09-notifications-and-manuals
plan: 02
subsystem: email-templates
tags: [email, react-email, notifications, transactional]
dependency_graph:
  requires: [09-01]
  provides: [email-templates-complete]
  affects: [09-03, 09-04, 09-05, 09-06]
tech_stack:
  added: []
  patterns: [react-email-component-pattern, typed-props-interface, inline-styles]
key_files:
  created:
    - apps/web/emails/discrepancy-alert.tsx
    - apps/web/emails/uninvoiced-alert.tsx
    - apps/web/emails/defective-batch-alert.tsx
    - apps/web/emails/facility-inactive-alert.tsx
    - apps/web/emails/warehouse-ageing-alert.tsx
    - apps/web/emails/pickup-confirmed.tsx
  modified: []
decisions:
  - "Template literal syntax for Preview with numeric props — @react-email Preview expects ReactNode & string; template literals resolve number-to-string coercion at compile time"
metrics:
  duration_seconds: 144
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
requirements_addressed: [NOTIF-04]
---

# Phase 09 Plan 02: Email Templates — Notification Matrix Gap Fill Summary

Six React Email templates for transactional notification events, completing the full notification matrix gap identified in the PRD (NOTIF-04).

## What Was Built

All six missing email templates now exist in `apps/web/emails/`, matching the established `pickup-admin-alert.tsx` pattern exactly: `@react-email/components` imports, typed props interfaces, `#f6f6f6` background, 560px container, white detail card section, black CTA button, `NEXT_PUBLIC_APP_DOMAIN`-based URL construction.

### Task 1: Critical Event Templates (4 templates)

| Template | Component | Event |
|----------|-----------|-------|
| `discrepancy-alert.tsx` | `DiscrepancyAlertEmail` | Intake discrepancy > configured threshold % |
| `uninvoiced-alert.tsx` | `UninvoicedAlertEmail` | Uninvoiced deliveries older than 14 days |
| `defective-batch-alert.tsx` | `DefectiveBatchAlertEmail` | Batch matches flagged/defective batch entry |
| `facility-inactive-alert.tsx` | `FacilityInactiveAlertEmail` | Prison facility with no intake for >14 days |

### Task 2: Non-Critical Event Templates (2 templates)

| Template | Component | Event |
|----------|-----------|-------|
| `warehouse-ageing-alert.tsx` | `WarehouseAgeingAlertEmail` | Pallets exceed configured ageing threshold |
| `pickup-confirmed.tsx` | `PickupConfirmedEmail` | Client-facing pickup confirmation on admin confirm |

## Decisions Made

- **Template literal for Preview with numbers:** `@react-email/components` Preview component's TypeScript type requires `ReactNode & string`. JSX expression `{someNumber}` satisfies `ReactNode` but not `string`. Template literals (`\`${someNumber} text\``) satisfy both — applied to all three templates with numeric props in Preview text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript errors in Preview components with numeric props**
- **Found during:** Task 1 verification (TypeScript compilation)
- **Issue:** Three templates used JSX number interpolation directly in `<Preview>` text alongside string content. `@react-email/components` Preview type is `ReactNode & string`, causing TS2322 errors on number values.
- **Fix:** Converted Preview content to template literals for `discrepancy-alert.tsx`, `uninvoiced-alert.tsx`, `facility-inactive-alert.tsx`, and proactively applied the same pattern to `warehouse-ageing-alert.tsx` in Task 2.
- **Files modified:** `discrepancy-alert.tsx`, `uninvoiced-alert.tsx`, `facility-inactive-alert.tsx`, `warehouse-ageing-alert.tsx`
- **Commits:** 2fb65d7 (fix applied within Task 1 commit)

## Known Stubs

None — templates have no hardcoded placeholder values. All content flows from typed props. URLs use `NEXT_PUBLIC_APP_DOMAIN` with a relative path fallback, matching the existing pattern.

## Commits

| Hash | Message |
|------|---------|
| 2fb65d7 | feat(09-02): add four critical event email templates |
| 387e660 | feat(09-02): add two non-critical event email templates |

## Self-Check: PASSED
