# Phase 6: Prison Processing, Dispatch, and Audit Trail - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Prison staff can submit Wash and Pack processing reports and view the full traceability chain; reco-admin can create outbound dispatch records; every editable record type has a complete, trigger-based audit trail.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — user deferred all decisions to Claude's judgment. Follow established codebase patterns, prior phase conventions, and domain best practices throughout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Intake schema, RLS patterns, and withRLSContext wrapper from Phase 5
- Server Action patterns (requirePrisonSession, requireRecoAdmin) established in Phase 5
- shadcn/ui components already installed (Table, Dialog, Tabs, Badge, Select, Alert)
- Discrepancy utility functions (lib/discrepancy.ts, lib/persistent-flag.ts) available
- next-intl Danish i18n infrastructure in place (messages/da.json)

### Established Patterns
- Server Components with async Server Actions for data mutations
- withRLSContext for all DB queries, role-gated session checks
- Drizzle ORM schema definitions in packages/db/src/schema/
- Raw SQL migrations in packages/db/migrations/
- Wave-based plan structure: schema first, then UI

### Integration Points
- intake_records table as the upstream FK anchor for processing records
- outbound_shipments table for dispatch records (Phase 4)
- audit_log table will need to be created for trigger-based audit trail
- ops portal at app/(ops)/ for reco-admin views
- prison portal at app/prison/ for staff views

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow patterns established in prior phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
