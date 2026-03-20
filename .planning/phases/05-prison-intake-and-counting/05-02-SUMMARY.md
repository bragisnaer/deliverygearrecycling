---
phase: 05-prison-intake-and-counting
plan: "02"
subsystem: prison-tablet-shell
tags: [i18n, next-intl, prison, tablet, ops-nav]
dependency_graph:
  requires: []
  provides: [prison-tablet-shell, danish-i18n, ops-intake-nav]
  affects: [apps/web/app/prison, apps/web/app/(ops)/ops-nav-bar.tsx]
tech_stack:
  added: [next-intl@4.8.3, shadcn/select, shadcn/skeleton, shadcn/alert]
  patterns: [NextIntlClientProvider, getRequestConfig, createNextIntlPlugin]
key_files:
  created:
    - apps/web/app/prison/layout.tsx
    - apps/web/app/prison/page.tsx
    - apps/web/i18n/request.ts
    - apps/web/messages/da.json
    - apps/web/components/ui/select.tsx
    - apps/web/components/ui/skeleton.tsx
    - apps/web/components/ui/alert.tsx
  modified:
    - apps/web/next.config.ts
    - apps/web/app/(ops)/ops-nav-bar.tsx
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "Prison layout uses auth() directly (not requireAuth) — redirect to /prison/login if no session or role is not prison; avoids requireAuth's /access-denied redirect which is wrong for tablet users"
  - "Prison page.tsx is Client Component — useTranslations() from next-intl requires use client; tabs interactivity also requires client"
  - "da.json uses Unicode escapes for Danish special chars (ae=\u00e6, oe=\u00f8, aa=\u00e5, aa=\u00e5) to ensure consistent encoding across editors"
metrics:
  duration_minutes: 2
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 11
---

# Phase 05 Plan 02: Prison Tablet Shell and Danish i18n Summary

**One-liner:** next-intl installed with Danish locale, prison tablet shell layout with NextIntlClientProvider role gate, and home screen with Registrer Levering CTA and tab structure.

## What Was Built

### Task 1: Install next-intl and configure i18n (commit `2fafdc6`)

- Installed `next-intl@4.8.3` in `@repo/web`
- Created `apps/web/i18n/request.ts` — `getRequestConfig` returning `da` locale with messages from `da.json`
- Created `apps/web/messages/da.json` — full Danish string set for prison tablet UI: home screen, intake form, discrepancy warnings, quarantine alerts, success screen, and errors
- Updated `apps/web/next.config.ts` to wrap existing config with `createNextIntlPlugin('./i18n/request.ts')`
- Added shadcn components: `select`, `skeleton`, `alert` (needed later in this phase)

### Task 2: Prison layout, home screen, ops nav (commit `36cb408`)

- Created `apps/web/app/prison/layout.tsx` — server component with `auth()` role gate (redirects to `/prison/login` if unauthenticated or not prison role), `getMessages()`, and `NextIntlClientProvider` wrapping children; top bar shows reco logo left, facility_id centred, spacer right
- Created `apps/web/app/prison/page.tsx` — client component using `useTranslations('intake.home')`; primary CTA link to `/prison/incoming` (red fill, min-h-[48px], Consolas font); shadcn Tabs with Forventede Leveringer (default) and Historik tabs; empty state strings from da.json
- Updated `apps/web/app/(ops)/ops-nav-bar.tsx` — added `{ label: 'Intake', href: '/intake' }` between Transport and Products

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prison layout uses `auth()` directly instead of `requireAuth()`**
- **Found during:** Task 2
- **Issue:** `requireAuth(['prison'])` redirects to `/access-denied` when role mismatch — wrong for tablet users who should reach `/prison/login`. The plan specified calling `auth()` and checking `session.user.role === 'prison'` but also referenced `requireAuth`. Used `auth()` directly to redirect correctly to `/prison/login`.
- **Fix:** Imported `auth` from `@/auth` directly; redirects to `/prison/login` in both cases (no session, wrong role)
- **Files modified:** `apps/web/app/prison/layout.tsx`
- **Commit:** `36cb408`

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `apps/web/app/prison/page.tsx` | "Forventede Leveringer" tab content shows `t('no_deliveries')` empty state | Data fetching wired in Plan 03 (expected deliveries grid) |
| `apps/web/app/prison/page.tsx` | "Historik" tab content shows `t('no_history')` empty state | History table wired in Plan 03 |

These stubs are intentional — the tab structure is the scaffold for Plan 03's data layer. The primary CTA and navigation structure are fully functional.

## Test Results

All 46 tests pass (8 test files, 11 todo, 2 skipped test files). No regressions.

## Self-Check: PASSED

- [x] `apps/web/app/prison/layout.tsx` exists
- [x] `apps/web/app/prison/page.tsx` exists
- [x] `apps/web/i18n/request.ts` exists
- [x] `apps/web/messages/da.json` exists
- [x] `apps/web/next.config.ts` contains `createNextIntlPlugin`
- [x] `apps/web/app/(ops)/ops-nav-bar.tsx` contains `Intake` nav item
- [x] Commits `2fafdc6` and `36cb408` confirmed in git log
