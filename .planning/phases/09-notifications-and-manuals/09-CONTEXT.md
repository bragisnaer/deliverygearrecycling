# Phase 9: Notifications and Manuals - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

All roles receive timely notifications for critical events; client and prison users have role-appropriate manual content accessible from their portals.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — user deferred all decisions to Claude's judgment. Follow established codebase patterns, prior phase conventions, and domain best practices throughout.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- notifications table already in use (Phase 5 unexpected_intake notifications)
- All portal layouts established with nav bars
- next-intl i18n infrastructure in place for Danish content
- shadcn/ui Alert, Badge, Dialog components available

### Established Patterns
- Server Actions for notification reads/marks
- withRLSContext for role-scoped notification queries
- Portal-specific layouts for contextual content delivery

### Integration Points
- notifications table from Phase 1 schema
- Event triggers from intake, processing, financial phases
- Manual content as MDX or DB-stored content per role

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Follow patterns established in prior phases.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
