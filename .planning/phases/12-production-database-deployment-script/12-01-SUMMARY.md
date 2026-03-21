---
phase: 12-production-database-deployment-script
plan: "01"
subsystem: database-deployment
tags: [database, deployment, migrations, production, audit-triggers]
dependency_graph:
  requires:
    - packages/db/migrations/*.sql (all 7 manual supplement files)
    - packages/db (db:migrate command)
  provides:
    - scripts/deploy-db-production.sh
    - pnpm db:deploy command
  affects:
    - LOCAL-BETA-CHECKLIST.md
    - package.json
tech_stack:
  added: []
  patterns:
    - bash set -euo pipefail for safe shell scripting
    - psql -f for deterministic SQL file application
    - information_schema.triggers verification query
key_files:
  created:
    - scripts/deploy-db-production.sh
  modified:
    - package.json
    - LOCAL-BETA-CHECKLIST.md
decisions:
  - "deploy-db-production.sh mirrors setup-local-db.sh structure with the seed step replaced by trigger verification — production databases must never receive test data"
  - "Production safety prompt (read -p) requires explicit y/Y confirmation before any migrations are applied"
  - "Trigger verification exits non-zero if fewer than 3 audit triggers found — fail-fast prevents silent deployment without audit coverage"
metrics:
  duration_minutes: 1
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
requirements_closed:
  - AUDIT-06
---

# Phase 12 Plan 01: Production Database Deployment Script Summary

Single-command production database deployment via `pnpm db:deploy` — applies Drizzle journal migrations, all 7 manual supplement SQL files in dependency order, and verifies the 3 audit triggers exist before declaring success.

## What Was Built

### scripts/deploy-db-production.sh (93 lines)

Production database deployment script modelled on `setup-local-db.sh` with three key differences:

1. **Production safety prompt** — requires explicit `y/Y` confirmation before running anything, displaying the target `DATABASE_URL` so the operator can verify they are connected to the right database
2. **No seed data** — replaces the `seed:wolt` step with trigger verification; test data must never be applied to production
3. **Trigger verification** — Step 3 queries `information_schema.triggers` for all 3 audit triggers (`audit_intake_records`, `audit_processing_reports`, `audit_outbound_dispatches`); exits 1 with diagnostic instructions if any are missing

The script applies migrations in the exact same dependency order as `setup-local-db.sh`:
- Step 1: `pnpm --filter @repo/db db:migrate` (Drizzle journal)
- Step 2: 7 manual supplement files via `psql -f`
- Step 3: Trigger count verification

`0007_esg_dashboard_indexes.sql` is explicitly skipped with a comment (already in Drizzle journal at idx 5).

### package.json

Added `"db:deploy": "bash scripts/deploy-db-production.sh"` after the `format` entry in the root `scripts` object.

### LOCAL-BETA-CHECKLIST.md

- Added production vs. local dev distinction in "Step 2 — Build the database" section
- Marked the `audit_log` trigger gap row as `Closed` — `pnpm db:deploy` applies `0005_phase6_processing_dispatch_audit.sql` automatically, closing the AUDIT-06 deployment gap identified in the v1.0 audit

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 5733895 | feat(12-01): add production database deployment script and db:deploy command |
| Task 2 | 22366e6 | docs(12-01): update LOCAL-BETA-CHECKLIST.md with pnpm db:deploy as canonical production command |

## Known Stubs

None.

## Self-Check: PASSED

- scripts/deploy-db-production.sh: EXISTS (93 lines, contains set -euo pipefail)
- package.json db:deploy entry: EXISTS ("db:deploy": "bash scripts/deploy-db-production.sh")
- LOCAL-BETA-CHECKLIST.md pnpm db:deploy reference: EXISTS
- Commit 5733895: VERIFIED
- Commit 22366e6: VERIFIED
