---
phase: 01-infrastructure-foundation
plan: 06
subsystem: ui
tags: [shadcn, react-hook-form, zod, sonner, drizzle-orm, next-auth, server-actions]

# Dependency graph
requires:
  - phase: 01-infrastructure-foundation/01-02
    provides: Drizzle schema (systemSettings, prisonFacilities tables)
  - phase: 01-infrastructure-foundation/01-05
    provides: requireAuth auth guard, (ops) route group layout
provides:
  - System Settings page at /settings (reco-admin only)
  - General tab: exchange rate + alert thresholds with upsert Server Actions
  - Facilities tab: inline editable prison facility registry with slug field
  - shadcn/ui component set: tabs, card, input, table, dialog, badge, label, sonner, form
  - Toaster in root layout for toast feedback
affects:
  - phase-02-and-beyond: facility slug used in prison login URL (/prison/login?facility=X)
  - phase-04-transport: facility registry prerequisite for transport booking
  - phase-05-prison: facility registry prerequisite for prison auth flow (AUTH-05)

# Tech tracking
tech-stack:
  added:
    - react-hook-form (already in deps, now actively used via Form wrapper)
    - "@hookform/resolvers/zod" (zod resolver for form validation)
    - sonner (toast notifications, already in deps, now wired to layout)
    - next-themes (already in deps, used by Toaster component)
    - base-ui/react (tabs, dialog, input, button — base-nova shadcn style)
  patterns:
    - Server Actions for all settings CRUD (no API routes)
    - Singleton upsert pattern: db.insert.onConflictDoUpdate for systemSettings id=1
    - requireRecoAdmin() auth helper in Server Actions (not just route-level guard)
    - Drizzle numeric column → string coercion (toFixed(4)) for insert
    - Two separate form instances per tab panel (each has its own Save button and isDirty state)
    - Optimistic client-state updates for inline table editing (pendingChanges map)

key-files:
  created:
    - apps/web/app/(ops)/settings/page.tsx
    - apps/web/app/(ops)/settings/actions.ts
    - apps/web/app/(ops)/settings/general-settings-form.tsx
    - apps/web/app/(ops)/settings/facilities-table.tsx
    - apps/web/components/ui/form.tsx
    - apps/web/components/ui/tabs.tsx
    - apps/web/components/ui/card.tsx
    - apps/web/components/ui/input.tsx
    - apps/web/components/ui/table.tsx
    - apps/web/components/ui/dialog.tsx
    - apps/web/components/ui/badge.tsx
    - apps/web/components/ui/label.tsx
    - apps/web/components/ui/sonner.tsx
  modified:
    - apps/web/app/layout.tsx (Toaster added)

key-decisions:
  - "form.tsx created manually — base-nova shadcn style has no form component in registry; built as thin react-hook-form FormProvider wrapper with FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage"
  - "Drizzle numeric('exchange_rate_eur_dkk') maps to TypeScript string type — toFixed(4) conversion applied before DB insert to satisfy type constraint"
  - "Two separate form instances in GeneralSettingsForm (one per Card) so each has independent isDirty tracking and Save button"
  - "facilities-table.tsx uses local client state (pendingChanges map) for inline editing — server revalidation only on explicit Save or Archive"

patterns-established:
  - "Server Action auth pattern: requireRecoAdmin() called at top of every action — never rely solely on route-level guard"
  - "Drizzle numeric insert pattern: always convert number to string via toFixed(N) before inserting into numeric columns"
  - "Inline table editing pattern: editState + pendingChanges + local facilities state; batch save on explicit button click"
  - "Toast feedback pattern: sonner toast.success / toast.error after Server Action resolves"

requirements-completed: [SETTINGS-01, SETTINGS-02, AUTH-08]

# Metrics
duration: 15min
completed: 2026-03-20
---

# Phase 01 Plan 06: System Settings Summary

**reco-admin settings page with tabbed General (exchange rate + thresholds) and Facilities (inline editable prison facility registry with slug) tabs, backed by Drizzle Server Actions**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-20T10:15:30Z
- **Completed:** 2026-03-20T10:25:03Z
- **Tasks:** 2 of 2 auto tasks + 1 checkpoint (auto-approved)
- **Files modified:** 16

## Accomplishments

- System Settings page at `/settings` — reco-admin only via `requireAuth(['reco-admin'])`
- General tab: two Card sections (Exchange Rate, Alert Thresholds), each with react-hook-form + zod validation, isDirty-gated Save button, sonner toasts on success/error
- Facilities tab: inline editable table with slug column, Add facility row append, Enter/Escape keyboard handling, pending-row left-border indicator, archive confirmation dialog, empty state
- Full shadcn/ui component set installed for the project (tabs, card, input, table, dialog, badge, label, sonner, form)
- Toaster wired to root layout for app-wide toast support

## Task Commits

Each task was committed atomically:

1. **Task 1: Install shadcn/ui components and create Server Actions** - `add44bd` (feat)
2. **Task 2: Build Settings page UI** - `cab69f6` (feat)
3. **Task 3: Visual verification** - auto-approved checkpoint (no commit)

## Files Created/Modified

- `apps/web/app/(ops)/settings/page.tsx` - Server Component, loads settings+facilities in parallel, renders tab layout
- `apps/web/app/(ops)/settings/actions.ts` - Server Actions: getGeneralSettings, saveGeneralSettings, getFacilities, createFacility, updateFacility, archiveFacility, restoreFacility
- `apps/web/app/(ops)/settings/general-settings-form.tsx` - Client component: two Card forms with react-hook-form, zod validation, isDirty save gating
- `apps/web/app/(ops)/settings/facilities-table.tsx` - Client component: inline editable table, archive dialog, pending-changes tracking
- `apps/web/components/ui/form.tsx` - Custom react-hook-form wrapper (FormProvider, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage)
- `apps/web/components/ui/tabs.tsx` - shadcn base-nova tabs (base-ui/react)
- `apps/web/components/ui/card.tsx` - shadcn base-nova card
- `apps/web/components/ui/input.tsx` - shadcn base-nova input
- `apps/web/components/ui/table.tsx` - shadcn base-nova table
- `apps/web/components/ui/dialog.tsx` - shadcn base-nova dialog
- `apps/web/components/ui/badge.tsx` - shadcn base-nova badge
- `apps/web/components/ui/label.tsx` - shadcn base-nova label
- `apps/web/components/ui/sonner.tsx` - shadcn base-nova sonner toaster
- `apps/web/app/layout.tsx` - Added Toaster component (bottom-right position)

## Decisions Made

- form.tsx created manually as the base-nova shadcn style does not include a form component in its registry
- Two separate form instances per tab panel to give each Card its own isDirty/Save button state
- Drizzle numeric column requires string type — applied toFixed(4) conversion before DB insert
- Inline table editing uses optimistic local state (pendingChanges map) with batch save

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drizzle numeric column type incompatibility**
- **Found during:** Task 1 (Server Actions)
- **Issue:** `exchange_rate_eur_dkk` is a Drizzle `numeric()` column — TypeScript type is `string`, not `number`. The plan's code passed `number` directly, causing type error
- **Fix:** Added `toFixed(4)` conversion when building `dbValues` before the insert
- **Files modified:** apps/web/app/(ops)/settings/actions.ts
- **Verification:** `pnpm turbo build` passed with no type errors
- **Committed in:** add44bd (Task 1 commit)

**2. [Rule 2 - Missing Critical] Created form.tsx component**
- **Found during:** Task 1 (component install)
- **Issue:** The plan specified `apps/web/components/ui/form.tsx` as a required file, but the base-nova shadcn registry has no `form` component — `npx shadcn add form` silently skipped
- **Fix:** Created form.tsx manually as a standard react-hook-form FormProvider wrapper following the same pattern used in other shadcn styles
- **Files modified:** apps/web/components/ui/form.tsx (created)
- **Verification:** TypeScript compilation passes, form validation works in GeneralSettingsForm
- **Committed in:** add44bd (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 type bug, 1 missing critical component)
**Impact on plan:** Both fixes essential for correctness. No scope creep.

## Issues Encountered

- `npx shadcn add form` produced no output and created no file — the base-nova style registry does not include a form component. Handled by creating it manually.
- Unused `useCallback` and dead `fetch('/api/settings')` call from initial draft were cleaned up before final commit.

## User Setup Required

None for this plan — no new external services. The Resend API key (`AUTH_RESEND_KEY`) was already required by plan 01-05.

## Next Phase Readiness

- `/settings` page is fully functional for reco-admin configuration
- Facility slug field is in DB schema and Server Actions — prerequisite met for prison auth flow (AUTH-05, Phase 5)
- All shadcn/ui components now installed — no further component installs needed for Phase 1
- Phase 2 (user management) can reference the facilities table as a foreign key source

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-03-20*

## Self-Check: PASSED

- `apps/web/app/(ops)/settings/page.tsx` — FOUND
- `apps/web/app/(ops)/settings/actions.ts` — FOUND
- `apps/web/app/(ops)/settings/general-settings-form.tsx` — FOUND
- `apps/web/app/(ops)/settings/facilities-table.tsx` — FOUND
- `apps/web/components/ui/form.tsx` — FOUND
- Commit add44bd — FOUND
- Commit cab69f6 — FOUND
