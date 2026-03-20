---
phase: 01-infrastructure-foundation
plan: 05
subsystem: auth-routing
tags: [auth, routing, route-groups, auth-guard, sign-in, prison-login]
dependency_graph:
  requires: [01-03, 01-04]
  provides: [route-group-shells, auth-guard, sign-in-page, prison-login-page]
  affects: [all-future-protected-pages]
tech_stack:
  added: []
  patterns: [server-component-auth-guard, route-group-role-enforcement, dual-provider-sign-in, facility-magic-link-flow]
key_files:
  created:
    - apps/web/lib/auth-guard.ts
    - apps/web/app/(ops)/layout.tsx
    - apps/web/app/(ops)/dashboard/page.tsx
    - apps/web/app/(client)/layout.tsx
    - apps/web/app/(client)/overview/page.tsx
    - apps/web/app/(public)/layout.tsx
    - apps/web/app/(public)/home/page.tsx
    - apps/web/app/sign-in/page.tsx
    - apps/web/app/prison/login/page.tsx
    - apps/web/app/access-denied/page.tsx
    - apps/web/app/api/prison/send-login/route.ts
  modified:
    - apps/web/app/page.tsx
decisions:
  - "Route group pages placed under named paths (/dashboard, /overview, /home) not root — Next.js route groups do not segment the URL path so all root page.tsx files conflict"
  - "Root app/page.tsx acts as role-based dispatcher — redirects authenticated users to correct group, unauthenticated to /sign-in"
  - "API route uses @repo/db direct import (not @repo/db/schema subpath) — no exports field in db package.json for subpath"
  - "prisonFacilities.contact_email used (snake_case JS property) matching schema definition — plan's contactEmail reference was incorrect"
metrics:
  duration_seconds: 240
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 11
  files_modified: 1
---

# Phase 01 Plan 05: Route Group Shells and Auth Guards Summary

**One-liner:** Three Next.js route group layouts with server-side role enforcement via reusable `requireAuth()` guard, dual-provider sign-in page, and bookmarkable prison facility magic-link login page.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Route group layouts with auth guard utility | 71af295 | auth-guard.ts, (ops)/layout.tsx, (client)/layout.tsx, (public)/layout.tsx, 3 placeholder pages, page.tsx |
| 2 | Sign-in page, prison login page, access-denied, API route | 6018947 | sign-in/page.tsx, prison/login/page.tsx, access-denied/page.tsx, api/prison/send-login/route.ts |

## What Was Built

### Auth Guard Utility (`apps/web/lib/auth-guard.ts`)
Reusable server-side function `requireAuth(allowedRoles: UserRole[])` that:
- Calls `auth()` from Auth.js — redirects to `/sign-in` if no session
- Checks role against `allowedRoles` — redirects to `/access-denied` if wrong role
- Returns typed `AuthResult` with user claims for use in layouts/pages

### Route Group Layouts
- `(ops)/layout.tsx` — enforces `['reco-admin', 'reco', 'transport', 'prison']`
- `(client)/layout.tsx` — enforces `['client', 'client-global']`
- `(public)/layout.tsx` — no auth, marketing shell

### Sign-In Page (`/sign-in`)
Client component with two paths: Microsoft Entra ID button for reco staff, email magic link form for external users (client, transport, prison). Uses `signIn()` from `next-auth/react`.

### Prison Facility Login (`/prison/login?facility=X`)
Bookmarkable tablet URL. Reads `?facility=X` slug from URL via `useSearchParams`. Single "Send login link" button POSTs to `/api/prison/send-login`. Large touch target (`py-4`). Wrapped in `Suspense` for `useSearchParams` compatibility.

### Prison Send-Login API (`/api/prison/send-login`)
POST route: validates facility slug, queries `prison_facilities` by slug, checks `active` flag, triggers `signIn('resend')` magic link to `contact_email`. Returns structured errors for missing facility (404), inactive (403).

### Access Denied Page (`/access-denied`)
Static page with link back to `/sign-in`. Target for wrong-role redirects from `requireAuth()`.

### Root Dispatcher (`app/page.tsx`)
Server component that redirects: ops roles → `/dashboard`, client roles → `/overview`, unauthenticated → `/sign-in`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Route group pages caused parallel path conflict**
- **Found during:** Task 1 build verification
- **Issue:** `(ops)/page.tsx`, `(client)/page.tsx`, and `(public)/page.tsx` all resolved to `/` — Next.js route groups do not segment URL paths, so multiple root pages conflict with each other and with `app/page.tsx`
- **Fix:** Moved pages to named subdirectories: `(ops)/dashboard/page.tsx` → `/dashboard`, `(client)/overview/page.tsx` → `/overview`, `(public)/home/page.tsx` → `/home`. Root `page.tsx` updated to act as role-based dispatcher.
- **Files modified:** `app/page.tsx`, route group page paths
- **Commit:** 71af295

**2. [Rule 1 - Bug] API route used invalid `@repo/db/schema` subpath import**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified `import { prisonFacilities } from '@repo/db/schema'` but `packages/db/package.json` has no `exports` field with a `/schema` subpath — this would fail at runtime
- **Fix:** Changed to `import { db, prisonFacilities } from '@repo/db'` — the index re-exports all schema tables
- **Files modified:** `apps/web/app/api/prison/send-login/route.ts`
- **Commit:** 6018947

**3. [Rule 1 - Bug] Plan used `prisonFacilities.contactEmail` (camelCase) but schema defines `contact_email` (snake_case)**
- **Found during:** Task 2 implementation
- **Issue:** Drizzle schema in `packages/db/src/schema/tenants.ts` line 63 defines the field as `contact_email` not `contactEmail`
- **Fix:** Used `prisonFacilities.contact_email` throughout the API route
- **Files modified:** `apps/web/app/api/prison/send-login/route.ts`
- **Commit:** 6018947

## Self-Check: PASSED

All 8 key files found on disk. Both task commits (71af295, 6018947) verified in git log.
