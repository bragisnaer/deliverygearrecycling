# Phase 8: Dashboards and ESG Metrics - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

reco-admin, client, and transport users each have a role-scoped dashboard showing their most important operational data; ESG metrics are calculated from actual intake records and are exportable.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — user deferred all decisions to Claude's judgment. Follow established codebase patterns, prior phase conventions, and domain best practices throughout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- All portal layouts established (ops, client, prison, transport)
- Aggregate SQL query patterns from Phase 5 discrepancy dashboard
- shadcn/ui Tabs, Table, Badge, Card components available
- intake_records, processing records, financial_records as data sources

### Established Patterns
- Server Components fetching data via Server Actions
- Role-gated session helpers for each portal
- withRLSContext for tenant-scoped queries
- Ops portal pattern for admin dashboards

### Integration Points
- intake_records + processing records for ESG weight/volume data
- financial_records for invoice status summaries
- transport/pickup records for logistics KPIs
- CSV export via Response with Content-Disposition header

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow patterns established in prior phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
