---
phase: 11-phase06-verification-and-ship-blockers
plan: "01"
subsystem: database
tags: [drizzle, postgresql, migrations, rls, setup-script, env-vars]

requires:
  - phase: 10-historical-data-import
    provides: final migration file 0009_historical_import.sql and import_jobs table

provides:
  - Untracked Drizzle migration 0004_tense_chronomancer committed to git
  - scripts/setup-local-db.sh for reproducible fresh database setup
  - .env.example annotated with REQUIRED/OPTIONAL groupings for local beta

affects:
  - any new developer onboarding
  - CI/CD fresh database provisioning

tech-stack:
  added: []
  patterns:
    - "Two-class migration architecture: Drizzle-tracked (journal) + manual supplement (psql). db:migrate first, then manual files in dependency order."
    - "setup-local-db.sh wraps both classes in a single executable script with DATABASE_URL guard"

key-files:
  created:
    - scripts/setup-local-db.sh
  modified:
    - .env.example
    - packages/db/migrations/0004_tense_chronomancer.sql (git-tracked, was untracked)
    - packages/db/migrations/meta/0004_snapshot.json (git-tracked, was untracked)

key-decisions:
  - "Manual supplement files apply safely after db:migrate because all use IF NOT EXISTS / CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS guards"
  - "0007_esg_dashboard_indexes skipped in setup script — already applied by db:migrate (journal idx 5)"
  - "AUTH_RESEND_KEY + RESEND_API_KEY both listed as REQUIRED — re_test_xxx values prevent server crash without real email delivery in local dev"

patterns-established:
  - "setup-local-db.sh: Step 1 = db:migrate, Step 2 = psql manual supplements in dependency order, Step 3 = seed:wolt"

requirements-completed: []

duration: 2min
completed: "2026-03-21"
---

# Phase 11 Plan 01: Migration Cleanup and Local DB Setup Script Summary

**Drizzle migration 0004 committed to git, two-class migration architecture documented in setup-local-db.sh, and .env.example annotated with REQUIRED/OPTIONAL groupings for local beta startup**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T13:13:05Z
- **Completed:** 2026-03-21T13:14:54Z
- **Tasks:** 5
- **Files modified:** 4

## Accomplishments

- Committed previously untracked `0004_tense_chronomancer.sql` and `meta/0004_snapshot.json` — git status and journal now agree
- Created `scripts/setup-local-db.sh` with full commentary on the two-class migration architecture; script applies Drizzle journal migrations then manual supplement SQL files in dependency order, then runs Wolt seed data
- Verified all manual supplement files use idempotent guards (`IF NOT EXISTS`, `CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`) so they are safe to run after `db:migrate` in a single pass
- Verified `_journal.json` contains exactly idx 0–5 matching `0000` through `0004` plus `0007_esg_dashboard_indexes`; no edits required
- Annotated `.env.example` with REQUIRED/OPTIONAL groupings documenting the minimum variable set for local beta without real SMTP or Azure SSO

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit untracked Drizzle files** - `a7cb684` (chore)
2. **Task 2: Determine correct apply order** - (verification only, no code change)
3. **Task 3: Create scripts/setup-local-db.sh** - `abced1d` (chore)
4. **Task 4: Document minimum env vars for local beta** - `919624c` (chore)
5. **Task 5: Verify journal accuracy** - (verification only, no code change)

## Files Created/Modified

- `packages/db/migrations/0004_tense_chronomancer.sql` - Committed to git (was untracked; adds batch_flags, intake_lines, intake_records tables)
- `packages/db/migrations/meta/0004_snapshot.json` - Committed to git (was untracked; Drizzle snapshot for idx 4)
- `scripts/setup-local-db.sh` - New executable; full database setup from scratch with architecture commentary
- `.env.example` - Grouped into REQUIRED (Database, Auth, Email, Domain) and OPTIONAL (Supabase Storage, Azure SSO) sections

## Decisions Made

- Manual supplement files apply safely after `db:migrate` in a single pass because they all use idempotent guards — no interleaving needed
- `0007_esg_dashboard_indexes.sql` is intentionally skipped in the setup script since it is already in the Drizzle journal at idx 5 and would be double-applied otherwise
- `.env.example` placed at project root (not `apps/web/`); it already existed there with basic entries, updated in-place

## Deviations from Plan

None — plan executed exactly as written. The `.env.example` was found at the project root rather than `apps/web/` but the plan noted "review and annotate if grouping comments are missing", which was done at the correct file location.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Developer must still fill in `.env.example` values and copy to `.env.local`.

## Next Phase Readiness

- Fresh database setup is now reproducible: `export DATABASE_URL=... && bash scripts/setup-local-db.sh`
- Minimum env vars are documented in `.env.example` for local beta onboarding
- Ready for Phase 11 Plan 02 (Phase 06 verification) and Plan 03 (local beta checklist)

---
*Phase: 11-phase06-verification-and-ship-blockers*
*Completed: 2026-03-21*
