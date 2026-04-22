# Phase 7: Financial Tracking - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Every delivered intake record has a financial record with accurate two-leg cost breakdown and invoice status; reco-admin can manage invoice lifecycle and see uninvoiced delivery alerts.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — user deferred all decisions to Claude's judgment. Follow established codebase patterns, prior phase conventions, and domain best practices throughout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Two-leg cost model established in Phase 4 (transport management)
- withRLSContext, requireRecoAdmin patterns from prior phases
- shadcn/ui Table, Dialog, Badge, Select components available
- Drizzle ORM schema patterns in packages/db/src/schema/

### Established Patterns
- Server Components with Server Actions for mutations
- Role-gated session helpers (requireRecoAdmin, requireRecoSession)
- Raw SQL migrations for complex DB logic
- Ops portal layout and nav at app/(ops)/

### Integration Points
- intake_records table as the anchor for financial records
- outbound_shipments / transport for two-leg cost data (Phase 4)
- processing records from Phase 6 for cost allocation
- financial_records / invoices tables to be created

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow patterns established in prior phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
