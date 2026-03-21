# Phase 10: Historical Data Import - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

All historical operational data (2022-2026) is imported, flagged as imported records, and fully queryable in dashboards and reports from day one of live operations.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — user deferred all decisions to Claude's judgment. Follow established codebase patterns, prior phase conventions, and domain best practices throughout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- Full schema established across phases 1-9
- withRLSContext and DB connection patterns
- Drizzle ORM insert patterns from prior phases

### Established Patterns
- Raw SQL migrations for bulk operations
- is_imported flag pattern (similar to is_unexpected from Phase 5)
- Idempotent upsert patterns for safe re-runs

### Integration Points
- All domain tables (pickups, intake_records, processing, financial) as import targets
- Import scripts likely in a scripts/ or packages/import/ directory
- is_imported boolean column to flag historical records in dashboards

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow patterns established in prior phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
