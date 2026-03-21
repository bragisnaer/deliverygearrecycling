---
status: partial
phase: 11-phase06-verification-and-ship-blockers
source: [11-VERIFICATION.md]
started: 2026-03-21T00:00:00Z
updated: 2026-03-21T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. setup-local-db.sh execution
expected: Script exits 0 against a fresh PostgreSQL instance; `\dt` shows 20+ tables including pickups, intake_records, processing_reports, outbound_dispatches, audit_log, notifications, import_jobs; Wolt seed data present
result: [pending]

### 2. Prison home ≤2 taps to processing form (PROCESS-01)
expected: From the prison home screen, the processing form is reachable in at most 2 navigation taps/clicks on a tablet viewport
result: [pending]

### 3. Danish labels render correctly (PROCESS-04)
expected: All UI text in prison routes appears in Danish in the browser with next-intl locale resolution active
result: [pending]

### 4. Dispatch state machine enforced in UI (DISPATCH-03)
expected: Creating a dispatch shows status `created`; updating to `picked_up` succeeds; updating to `delivered` succeeds; reverse transition (delivered → created) is rejected
result: [pending]

### 5. Audit log trigger fires after record edit (AUDIT-01, AUDIT-06)
expected: After editing any intake or processing record, `SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5` returns a new row; trigger fires because `0005_phase6_processing_dispatch_audit.sql` was applied via `setup-local-db.sh`
result: [pending]

### 6. Void record excluded from dashboard totals (AUDIT-04)
expected: After voiding an intake record, dashboard totals do not include it; navigating to audit/void history shows the voided record
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
