---
phase: 06-prison-processing-dispatch-and-audit-trail
plan: 06
subsystem: ui
tags: [pipeline, processing, drizzle, vitest, audit-trail, danish-ui]

# Dependency graph
requires:
  - phase: 06-02
    provides: EditedIndicator component and isRecordEdited helper
  - phase: 06-04
    provides: processingReports schema with activity_type (wash/pack)
  - phase: 06-05
    provides: outboundDispatches schema for dispatch detection
  - phase: 06-07
    provides: audit_log infrastructure and getEditHistory pattern

provides:
  - derivePipelineStage pure function with full test coverage
  - Processing pipeline view at /processing in ops portal
  - getPipelineData server action grouping intake records by stage
  - PipelineCard client component with EditedIndicator + EditHistoryModal
  - getProcessingReportEditHistory server action
  - Processing nav link in ops nav bar

affects: [phase-07-financial, phase-08-esg, any future pipeline reporting]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Stage derivation as pure function (pipeline-stage.ts) — same pattern as discrepancy.ts and persistent-flag.ts
    - Parallel batch fetch pattern: single inArray query for reports + dispatches, raw db for audit_log
    - Client card component wrapping EditedIndicator + EditHistoryModal for interactive audit trail access

key-files:
  created:
    - apps/web/lib/pipeline-stage.ts
    - apps/web/lib/pipeline-stage.test.ts
    - apps/web/app/(ops)/processing/page.tsx
    - apps/web/app/(ops)/processing/pipeline-card.tsx
  modified:
    - apps/web/app/(ops)/processing/actions.ts
    - apps/web/app/(ops)/ops-nav-bar.tsx

key-decisions:
  - "getPipelineData uses 3-query batch pattern (intakes, then reports, then dispatches via inArray) — avoids N+1 without complex multi-join GROUP BY"
  - "Audit log isEdited check uses raw db (no RLS) with inArray — same pattern as getEditHistory in intake/actions.ts"
  - "PipelineCard extracted as client component — EditedIndicator click triggers async getProcessingReportEditHistory server action call, requires useState for modal open state"
  - "pipeline-card.tsx placed in processing route directory (not components/) — route-scoped client component, not reusable across routes"

patterns-established:
  - "Parallel batch fetch: fetch parent rows, extract IDs, inArray fetch children — avoids N+1 without complex JOIN"
  - "Client card wrapping server-fetched data with interactive audit trail: EditedIndicator → server action call → modal open"

requirements-completed: [PROCESS-03]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 06 Plan 06: Processing Pipeline View Summary

**Per-facility processing pipeline view grouping intake records into 4 Danish-labelled stage columns with EditedIndicator badges on edited processing report cards (AUDIT-05)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T22:00:12Z
- **Completed:** 2026-03-20T22:05:11Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `derivePipelineStage` pure function with 9 unit tests covering all four stage transitions and edge cases
- `getPipelineData` server action: batch-fetches intake records, processing reports (wash/pack), and dispatch records using `inArray` queries, then checks audit_log for `isEdited` per report
- Processing pipeline page at `/processing` with four stage columns (`Afventer behandling`, `Under behandling`, `Klar til forsendelse`, `Afsendt`) and badge counts
- `PipelineCard` client component renders `EditedIndicator` with `onViewHistory` wired to `getProcessingReportEditHistory` server action and `EditHistoryModal`
- Processing nav link added to ops nav bar

## Task Commits

1. **Task 1: derivePipelineStage pure function with tests** - `1ef1283` (feat + test — TDD red/green)
2. **Task 2: Pipeline view page with EditedIndicator and getPipelineData** - `f2b4160` (feat)

## Files Created/Modified

- `apps/web/lib/pipeline-stage.ts` - Pure stage derivation function, STAGE_ORDER, STAGE_LABELS
- `apps/web/lib/pipeline-stage.test.ts` - 9 unit tests for all stage transitions
- `apps/web/app/(ops)/processing/actions.ts` - Added getPipelineData and getProcessingReportEditHistory
- `apps/web/app/(ops)/processing/page.tsx` - Server component pipeline view with 4 stage columns
- `apps/web/app/(ops)/processing/pipeline-card.tsx` - Client component with EditedIndicator and modal
- `apps/web/app/(ops)/ops-nav-bar.tsx` - Added Processing nav link

## Decisions Made

- `getPipelineData` uses a 3-query batch pattern (intake rows, then reports via `inArray`, then dispatches via `inArray`) rather than a complex multi-join with GROUP BY — simpler Drizzle ORM code, same result, avoids N+1.
- Audit log `isEdited` check uses raw `db` (no RLS context) with `inArray` over report IDs — same pattern established by `getEditHistory` in intake/actions.ts (audit_log has no RLS policies).
- `PipelineCard` extracted as a client component in the processing route directory (not under `components/`) — it is route-scoped and not reusable across other routes.
- The `EditedIndicator` is rendered inside `PipelineCard` (client component) rather than directly in `page.tsx` (server component) because it requires `useState` for modal open state and an async server action call on click.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed unused imports from actions.ts**
- **Found during:** Task 2 (actions.ts update)
- **Issue:** `isRecordEdited` and `revalidatePath` were imported but not needed — `isRecordEdited` logic is replicated inline using a Set for O(1) lookup; no cache revalidation needed for read-only action
- **Fix:** Removed both unused imports before committing
- **Files modified:** apps/web/app/(ops)/processing/actions.ts
- **Committed in:** f2b4160 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing correctness: unused imports removed)
**Impact on plan:** No scope creep. Fix improves code cleanliness.

## Issues Encountered

None — all plan steps executed cleanly.

## Known Stubs

None — pipeline data is fully wired to DB queries. No hardcoded empty values in rendering path.

## Next Phase Readiness

- Pipeline view is complete and functional for reco-admin role
- Prison staff access is handled by RLS (facility-level isolation) — prison role can call `getPipelineData()` and the RLS on `processing_reports` and `outbound_dispatches` will automatically scope to their facility
- Ready for Phase 07 financial linking and Phase 08 ESG reporting which will reference the same intake records

---
*Phase: 06-prison-processing-dispatch-and-audit-trail*
*Completed: 2026-03-20*
