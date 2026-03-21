---
phase: 09-notifications-and-manuals
plan: 05
subsystem: ui
tags: [react-markdown, markdown, remark-gfm, rehype-raw, manual, next.js, rls]

# Dependency graph
requires:
  - phase: 09-01
    provides: manual_pages schema with RLS policies scoping client/prison context and published flag

provides:
  - ManualRenderer component using react-markdown with GFM tables, images, and iframe/PDF embeds
  - Client manual index at /manual listing published client context pages
  - Client manual page renderer at /manual/[slug] via ManualRenderer
  - Prison manual index at /prison/manual with Danish labels and tablet-first layout
  - Prison manual page renderer at /prison/manual/[slug] via ManualRenderer
  - Custom .manual-content CSS typography replacing @tailwindcss/typography

affects:
  - Any future plan adding manual page management or admin CRUD for manual_pages

# Tech tracking
tech-stack:
  added: []
  patterns:
    - withRLSContext user object includes sub, role, tenant_id, location_id, facility_id (full JWTClaims)
    - Server Component pages calling Server Actions that use withRLSContext for RLS-scoped DB queries
    - Prison pages use auth() directly with manual role guard (not requireAuth) — matches prison layout pattern
    - .manual-content CSS class provides prose typography without @tailwindcss/typography plugin

key-files:
  created:
    - apps/web/components/manual-renderer.tsx
    - apps/web/app/(client)/manual/actions.ts
    - apps/web/app/(client)/manual/page.tsx
    - apps/web/app/(client)/manual/[slug]/page.tsx
    - apps/web/app/prison/manual/actions.ts
    - apps/web/app/prison/manual/page.tsx
    - apps/web/app/prison/manual/[slug]/page.tsx
  modified:
    - apps/web/app/globals.css

key-decisions:
  - "withRLSContext requires full JWTClaims (sub + role + optional tenant/location/facility) — not just sub"
  - "Prison manual uses auth() + manual role check (not requireAuth) matching existing prison layout pattern"
  - "react-markdown packages (react-markdown@10.1.0, remark-gfm@4.0.1, rehype-raw@7.0.0) were already installed — no install step needed"
  - "Defence-in-depth: explicit context/published WHERE clauses in queries even though RLS already enforces isolation"

patterns-established:
  - "ManualRenderer: drop-in Server Component wrapping ReactMarkdown with GFM and raw HTML support"
  - "Manual actions follow same withRLSContext + spread user pattern as all other portal actions"

requirements-completed: [MANUAL-01, MANUAL-02, MANUAL-04]

# Metrics
duration: 15min
completed: 2026-03-21
---

# Phase 09 Plan 05: Manual Routes Summary

**react-markdown SSR rendering for role-scoped manual portals — client reads /manual, prison reads /prison/manual, both served from RLS-filtered manual_pages with GFM, image, and iframe support**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-21T11:20:00Z
- **Completed:** 2026-03-21T11:35:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- ManualRenderer component renders markdown using react-markdown 10 with remark-gfm (tables, strikethrough) and rehype-raw (iframe/HTML embeds for PDFs)
- Client portal manual at /manual lists published client-context pages; /manual/[slug] renders full markdown
- Prison portal manual at /prison/manual with Danish labels ("Driftsmanual", "Ingen manualsider tilgængelige endnu.") and p-6 tablet-friendly cards; /prison/manual/[slug] renders full markdown
- Custom .manual-content CSS in globals.css provides readable typography (headings, tables, code, blockquote, img, iframe) without adding @tailwindcss/typography dependency

## Task Commits

1. **Task 1: Install react-markdown, create ManualRenderer and typography CSS** - `9ce19be` (feat)
2. **Task 2: Create client and prison manual routes** - `c4a2d04` (feat)

## Files Created/Modified

- `apps/web/components/manual-renderer.tsx` - Server Component wrapping ReactMarkdown with GFM and rehypeRaw
- `apps/web/app/globals.css` - Appended .manual-content typography CSS
- `apps/web/app/(client)/manual/actions.ts` - getClientManualPages, getClientManualPage with withRLSContext
- `apps/web/app/(client)/manual/page.tsx` - Client manual index page
- `apps/web/app/(client)/manual/[slug]/page.tsx` - Client manual page with ManualRenderer
- `apps/web/app/prison/manual/actions.ts` - getPrisonManualPages, getPrisonManualPage with withRLSContext
- `apps/web/app/prison/manual/page.tsx` - Prison manual index with Danish labels and tablet-first layout
- `apps/web/app/prison/manual/[slug]/page.tsx` - Prison manual page with ManualRenderer

## Decisions Made

- `withRLSContext` requires full `JWTClaims` object (sub + role + tenant_id + location_id + facility_id) — plan showed only `{ sub }` which caused TS2345 error; fixed to spread all session user claims
- Prison actions use `auth()` directly with manual `role !== 'prison'` guard, matching the existing prison layout pattern (not `requireAuth` which redirects to /access-denied — wrong for tablet users)
- react-markdown, remark-gfm, rehype-raw were already present in package.json from a prior plan execution — install step skipped

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Full JWTClaims required — plan showed only { sub }**
- **Found during:** Task 2 (client and prison manual actions)
- **Issue:** Plan interface showed `{ sub: session.user.id! }` but `withRLSContext` signature requires `JWTClaims` which includes `role` as non-optional field alongside optional tenant/location/facility fields
- **Fix:** User objects in both actions files include `sub`, `role`, `tenant_id`, `location_id`, `facility_id` matching the JWTClaims interface in packages/db/src/rls.ts
- **Files modified:** apps/web/app/(client)/manual/actions.ts, apps/web/app/prison/manual/actions.ts
- **Verification:** TypeScript compilation shows zero errors in manual files
- **Committed in:** c4a2d04 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in plan interface spec)
**Impact on plan:** Required for TypeScript correctness and RLS context to function. No scope creep.

## Issues Encountered

- react-markdown packages already installed from a prior phase 09 plan — no install step was needed. Skipped `pnpm add` and proceeded directly to file creation.

## Known Stubs

None — ManualRenderer renders live content_md from the database. No hardcoded placeholder data.

## Next Phase Readiness

- Manual routes are fully wired for both portals. Client sees /manual, prison sees /prison/manual.
- reco-admin manual editor (create/edit manual_pages) is a separate concern and not part of this plan.
- Plan 09-06 (or whichever admin plan follows) can build the editor UI against the already-present manual_pages schema.

---
*Phase: 09-notifications-and-manuals*
*Completed: 2026-03-21*
