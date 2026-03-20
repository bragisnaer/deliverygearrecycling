---
phase: 02-auth-roles-and-tenant-branding
plan: 01
subsystem: auth
tags: [auth, credentials, bcrypt, user-management, settings]
dependency_graph:
  requires: [01-infrastructure-foundation]
  provides: [credentials-auth, user-invite, user-deactivation]
  affects: [apps/web/auth.ts, apps/web/app/sign-in, apps/web/app/(ops)/settings]
tech_stack:
  added: [bcryptjs, "@types/bcryptjs"]
  patterns: [Credentials provider with bcrypt, Server Actions for user management, base-ui Dialog with render prop]
key_files:
  created:
    - apps/web/app/(ops)/settings/users-tab.tsx
    - apps/web/app/(ops)/settings/users-table.tsx
    - apps/web/app/(ops)/settings/invite-user-dialog.tsx
  modified:
    - apps/web/auth.ts
    - apps/web/app/sign-in/page.tsx
    - packages/db/src/schema/auth.ts
    - apps/web/app/(ops)/settings/actions.ts
    - apps/web/app/(ops)/settings/page.tsx
decisions:
  - "authorize() returns full User object (id, email, name, role, tenant_id, location_id, facility_id) — required because next-auth User interface extends DefaultUser with custom fields in types/next-auth.d.ts"
  - "DialogTrigger uses render prop pattern (render=<Button />) not asChild — codebase uses @base-ui/react/dialog not Radix UI"
  - "inviteUser wraps signIn('resend') in try/catch — next-auth throws redirect error even with redirect:false"
metrics:
  duration_minutes: 25
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 8
requirements: [AUTH-09]
---

# Phase 02 Plan 01: Credentials Auth + User Management Summary

**One-liner:** Credentials provider (email/bcrypt) added to auth.ts alongside Resend magic link; MicrosoftEntraID removed; reco-admin user management UI (invite, deactivate, reactivate) built on settings page.

## What Was Built

### Task 1: Credentials provider, password_hash, sign-in page

- **`packages/db/src/schema/auth.ts`** — Added nullable `password_hash: text('password_hash')` column to the users table (after `image`, before `role`). Null for magic-link-only users.
- **`apps/web/auth.ts`** — Removed `MicrosoftEntraID` import and provider entirely. Added `Credentials` provider with `credentialsSchema` (Zod: email + password 8-72 chars), `bcrypt.compare` for password verification, returns full User object matching the extended next-auth User interface.
- **`apps/web/app/sign-in/page.tsx`** — Replaced Microsoft SSO button with a mode-toggling form: credentials mode (email + password, calls `signIn('credentials', { redirect: false })`), magic-link mode (email only, calls `signIn('resend')`). Toggle link switches between modes. Error display for bad credentials.

### Task 2: User management UI

- **`apps/web/app/(ops)/settings/actions.ts`** — Added four new Server Actions: `getUsers()` (SELECT id/email/role/tenant_id/active/created_at ordered by email), `inviteUser()` (insert user row + trigger Resend magic link with try/catch), `deactivateUser()` (set active=false), `reactivateUser()` (set active=true). All follow the existing pattern: `requireRecoAdmin()`, Zod validation, db operation, `revalidatePath('/settings')`.
- **`apps/web/app/(ops)/settings/users-tab.tsx`** — Server component that calls `getUsers()` and renders `<UsersTable users={users} />`.
- **`apps/web/app/(ops)/settings/users-table.tsx`** — Client component with columns: Email, Role, Tenant, Status (green Active / red Deactivated badges), Invited date, Actions (Deactivate/Reactivate buttons). Deactivate uses `window.confirm()` then calls Server Action + `router.refresh()`.
- **`apps/web/app/(ops)/settings/invite-user-dialog.tsx`** — Client component dialog with email input, role select (all 6 UserRole values), conditional tenant ID field (shown for client/client-global/transport/prison roles). On success: shows confirmation, triggers router.refresh(), auto-closes after 1.5s.
- **`apps/web/app/(ops)/settings/page.tsx`** — Added `UsersTab` import and a third `TabsTrigger value="users"` with matching `font-mono text-[13px] font-medium` className, plus `TabsContent value="users"`.

## Commits

| Hash | Description |
|------|-------------|
| `6e661c7` | feat(02-01): add Credentials provider, password_hash column, update sign-in page |
| `b619d6b` | feat(02-01): build user management UI — Users tab, table, invite dialog, Server Actions |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] authorize() return type mismatch — extended User interface**
- **Found during:** Task 1 TypeScript verification
- **Issue:** Plan specified `return { id, email, name }` but the project's `types/next-auth.d.ts` extends `User` with `role`, `tenant_id`, `location_id`, `facility_id` — TypeScript rejected the minimal return object
- **Fix:** authorize() now returns all custom User fields from the DB record (with null coalescing for uuid fields)
- **Files modified:** `apps/web/auth.ts`
- **Commit:** `6e661c7`

**2. [Rule 1 - Bug] DialogTrigger asChild not supported — @base-ui/react/dialog**
- **Found during:** Task 2 TypeScript verification
- **Issue:** Plan specified `<DialogTrigger asChild>` (Radix UI pattern) but the project uses `@base-ui/react/dialog` which uses `render` prop instead of `asChild`
- **Fix:** Changed to `<DialogTrigger render={<Button ... />}>` following the base-ui render prop pattern used throughout the codebase (e.g. facilities-table.tsx)
- **Files modified:** `apps/web/app/(ops)/settings/invite-user-dialog.tsx`
- **Commit:** `b619d6b`

## Self-Check: PASSED

Files verified:
- `apps/web/auth.ts` — exists, contains `import Credentials`, `import bcrypt`, `bcrypt.compare`, no `MicrosoftEntraID`
- `packages/db/src/schema/auth.ts` — contains `password_hash: text('password_hash')`
- `apps/web/app/sign-in/page.tsx` — contains `signIn('credentials'`, `type="password"`, no `microsoft-entra-id`
- `apps/web/app/(ops)/settings/actions.ts` — contains `getUsers`, `inviteUser`, `deactivateUser`, `reactivateUser`
- `apps/web/app/(ops)/settings/users-tab.tsx` — created, imports `getUsers`
- `apps/web/app/(ops)/settings/users-table.tsx` — created, `'use client'`, imports `deactivateUser`
- `apps/web/app/(ops)/settings/invite-user-dialog.tsx` — created, `'use client'`, imports `inviteUser`
- `apps/web/app/(ops)/settings/page.tsx` — contains `value="users"` TabsTrigger
- TypeScript: `pnpm --filter @repo/web exec tsc --noEmit` passes with no errors

Commits verified: `6e661c7`, `b619d6b` present in git log.
