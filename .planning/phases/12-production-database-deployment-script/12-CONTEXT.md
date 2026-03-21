# Phase 12: Production Database Deployment Script - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a `scripts/deploy-db-production.sh` script and `pnpm db:deploy` package.json entry that applies Drizzle migrations + all 7 manual supplement SQL files in dependency order against a production Supabase database. Update `LOCAL-BETA-CHECKLIST.md` to reference `pnpm db:deploy` as the canonical production DB setup command.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. The script should mirror `setup-local-db.sh` but omit the Wolt seed step (production-only). Should work with `DATABASE_URL` env var. The 7 supplement files are: `0001_rls_and_triggers.sql`, `0003_phase4_pickup_transport.sql`, `0004_intake_trigger_rls.sql`, `0005_phase6_processing_dispatch_audit.sql`, `0006_financial_records.sql`, `0008_notifications_manuals.sql`, `0009_historical_import.sql`.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/setup-local-db.sh` — existing local DB setup script; identical architecture (Drizzle migrate + supplement SQL); production version omits seed step
- `packages/db/migrations/` — contains all 13 SQL files (6 Drizzle-tracked + 7 manual supplements)

### Established Patterns
- `setup-local-db.sh` uses `set -euo pipefail`, `psql "$DATABASE_URL"`, `pnpm --filter @repo/db db:migrate`
- Supplement apply order already documented in `setup-local-db.sh` comments
- `LOCAL-BETA-CHECKLIST.md` at repo root references `bash scripts/setup-local-db.sh` in Step 2

### Integration Points
- Root `package.json` needs `"db:deploy": "bash scripts/deploy-db-production.sh"` entry
- `LOCAL-BETA-CHECKLIST.md` Step 2 environment setup section references DB setup command

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Production script should not run seed data (production DB should not have test data). Should print clear step-by-step progress output matching the style of setup-local-db.sh.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
