---
phase: 11-phase06-verification-and-ship-blockers
plan: "03"
subsystem: testing
tags: [beta-test, checklist, e2e, smoke-test, manual-testing]

requires:
  - phase: 06-prison-processing-dispatch-and-audit-trail
    provides: processing, dispatch, audit trail — the core Phase 06 features being verified
  - phase: 11-phase06-verification-and-ship-blockers
    provides: setup-local-db.sh (plan 11-01) for the DB build step in checklist

provides:
  - LOCAL-BETA-CHECKLIST.md — complete module-by-module manual test checklist at repo root
  - Beta sign-off table for all 9 app modules (A through I)
  - Known acceptable gaps table with severity and resolution paths

affects:
  - all-phases — checklist validates the full lifecycle from auth through historical import

tech-stack:
  added: []
  patterns:
    - "Beta checklist at repo root for developer discoverability"
    - "Module-by-module testing acceptable — no need for single-session full run"

key-files:
  created:
    - LOCAL-BETA-CHECKLIST.md
  modified: []

key-decisions:
  - "Checklist placed at repo root (not .planning/) for developer discoverability during active testing"
  - "No SMTP constraint documented upfront — email verification means notifications table row, not real inbox"
  - "setup-local-db.sh referenced from checklist (created in plan 11-01) — no duplication"

patterns-established:
  - "Beta readiness gate: all modules pass OR all failures are documented known gaps"

requirements-completed: []

duration: 8min
completed: 2026-03-21
---

# Phase 11 Plan 03: Local Beta Test Checklist Summary

**Module-by-module E2E smoke test checklist covering all 9 app modules (auth through historical import) with DB build steps, known acceptable gaps, and beta sign-off table**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-21T13:30:00Z
- **Completed:** 2026-03-21T13:38:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `LOCAL-BETA-CHECKLIST.md` at repo root with complete module-by-module test checklist
- Checklist covers all 9 modules: Auth, Pickup Booking, Transport + Intake, Processing + Dispatch (Phase 06 focus), Audit Trail, Financial, Dashboards + ESG, Notifications, Historical Import
- Environment setup section covers DB build, build verification, env var configuration, and Supabase optional setup
- Known acceptable gaps table with severity levels and go-live resolution paths
- Beta sign-off table for tester sign-off tracking

## Task Commits

1. **Task 1: Create LOCAL-BETA-CHECKLIST.md** - `2588783` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified

- `LOCAL-BETA-CHECKLIST.md` — Complete manual test checklist for local beta smoke testing; 9 modules with granular step-by-step checks, psql verification commands, and sign-off table

## Decisions Made

- Checklist placed at repo root for developer discoverability during active testing (not buried in `.planning/`)
- Email delivery verification scoped to `notifications` table existence + bell badge — no real inbox check required for beta
- `setup-local-db.sh` already created in plan 11-01; checklist references it without duplication
- Module D (Processing + Dispatch) given the most coverage as the Phase 06 focus area

## Deviations from Plan

None — plan executed exactly as written. The plan content IS the checklist; deliverable was to publish it as `LOCAL-BETA-CHECKLIST.md` in the repo root.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required by this plan. The checklist itself documents what developers need to configure before running it.

## Self-Check: PASSED

- `LOCAL-BETA-CHECKLIST.md` — FOUND
- `11-03-SUMMARY.md` — FOUND
- Commit `2588783` — FOUND

## Next Phase Readiness

- Beta checklist is complete and ready for developer use
- `scripts/setup-local-db.sh` (from plan 11-01) provides the DB build step the checklist references
- All three Phase 11 plans are now complete: migration cleanup (11-01), Phase 06 verification (11-02), and beta checklist (11-03)
- Ready for beta testing against a local PostgreSQL instance

---
*Phase: 11-phase06-verification-and-ship-blockers*
*Completed: 2026-03-21*
