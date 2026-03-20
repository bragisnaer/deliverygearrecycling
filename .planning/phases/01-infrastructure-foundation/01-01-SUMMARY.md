---
phase: 01-infrastructure-foundation
plan: 01
subsystem: infra
tags: [turborepo, pnpm-workspaces, nextjs, tailwind, shadcn, biome, drizzle, typescript, docker]

# Dependency graph
requires: []
provides:
  - Turborepo monorepo with pnpm workspaces (apps/web, packages/db, packages/types)
  - Next.js 16.2.0 App Router in apps/web, turbo build passing
  - Biome 2.4.8 linting and formatting config (tab indent, 100 lineWidth)
  - shadcn/ui initialised (base-nova, Tailwind v4) with reco brand CSS tokens
  - UserRole type and next-auth module augmentation in @repo/types
  - TenantContext and DomainContext types in @repo/types
  - Multi-stage Dockerfile for Azure Container Apps standalone build
  - .env.example documenting all required environment variables
affects: [02-database-schema, 03-auth, 04-routing, 05-deployment, 06-settings-ui, all-phases]

# Tech tracking
tech-stack:
  added:
    - turbo@2.8.20 (monorepo task orchestration)
    - next@16.2.0 (App Router, proxy.ts support)
    - next-auth@beta (Auth.js v5 for App Router)
    - drizzle-orm@0.45.1 + drizzle-kit@0.31.1
    - postgres driver
    - "@auth/drizzle-adapter@1.11.1"
    - "@biomejs/biome@2.4.8"
    - tailwindcss@4 + shadcn@4.1.0 (base-nova style)
    - tw-animate-css (inlined, bypasses Turbopack CSS limitation)
    - class-variance-authority, clsx, tailwind-merge
    - zod, react-hook-form, @hookform/resolvers
    - lucide-react, sonner
  patterns:
    - pnpm workspace:* protocol for cross-package dependencies
    - CSS-first Tailwind v4 configuration via @theme inline
    - reco brand tokens as CSS custom properties on :root
    - shadcn/tailwind.css and tw-animate-css inlined to avoid Turbopack CSS style-condition import limitation on Windows

key-files:
  created:
    - pnpm-workspace.yaml
    - turbo.json
    - biome.json
    - package.json
    - .env.example
    - .gitignore
    - .npmrc
    - apps/web/package.json
    - apps/web/next.config.ts
    - apps/web/tsconfig.json
    - apps/web/components.json
    - apps/web/app/globals.css
    - apps/web/app/layout.tsx
    - apps/web/app/page.tsx
    - apps/web/Dockerfile
    - apps/web/components/ui/button.tsx
    - apps/web/lib/utils.ts
    - packages/db/package.json
    - packages/db/tsconfig.json
    - packages/db/src/index.ts
    - packages/types/package.json
    - packages/types/tsconfig.json
    - packages/types/src/auth.ts
    - packages/types/src/tenant.ts
    - packages/types/src/index.ts
  modified: []

key-decisions:
  - "Biome 2.x uses 'assist.actions.source.organizeImports' not top-level 'organizeImports'"
  - "Biome 2.x files.includes uses negation patterns without trailing /** (e.g. !**/node_modules)"
  - "shadcn/tailwind.css and tw-animate-css inlined in globals.css — Turbopack on Windows cannot resolve CSS packages with 'style' export condition"
  - ".npmrc hoist patterns for tw-animate-css and shadcn to root node_modules (kept for future use)"
  - "next-auth@beta tag used (v5.0.0-beta.30) — latest tag is still v4.24.13"
  - "turbopack.root not set — setting it breaks Windows absolute path resolution in resolveAlias"

patterns-established:
  - "Pattern 1: CSS-only Tailwind v4 — no tailwind.config.js; all theme in @theme inline block in globals.css"
  - "Pattern 2: reco brand tokens declared as raw hex CSS vars on :root, mapped to Tailwind color tokens via @theme inline"
  - "Pattern 3: Workspace package resolution via tsconfig paths (@repo/db, @repo/types)"

requirements-completed: [ROUTE-02, ROUTE-03]

# Metrics
duration: 25min
completed: 2026-03-20
---

# Phase 01 Plan 01: Infrastructure Foundation Summary

**Turborepo monorepo with Next.js 16.2.0, Drizzle workspace, shadcn/ui Tailwind v4 initialised with reco brand tokens (#FAF9F4/#ED1C24/#000000), and multi-stage Dockerfile for Azure Container Apps**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-20T09:05:23Z
- **Completed:** 2026-03-20T09:30:00Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments

- Turborepo monorepo with pnpm workspaces linking @repo/web, @repo/db, @repo/types — `pnpm turbo build` passes
- shadcn/ui initialised with Tailwind v4 and reco brand tokens as CSS custom properties
- Biome 2.4.8 config with correct v2 schema — `biome check` passes on all source files
- UserRole type (6 roles) + next-auth Session/User/JWT module augmentation in @repo/types
- TenantContext and DomainContext types exported from @repo/types
- Multi-stage Dockerfile ready for Azure Container Apps standalone build

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold monorepo structure, Biome, Turborepo** - `0b1a461` (feat)
2. **Task 2: shadcn/ui, reco brand tokens, shared types, Dockerfile** - `454f15b` (feat)
3. **Fix: Biome v2 config schema + auto-format all source files** - `cf6c448` (fix)

## Files Created/Modified

- `pnpm-workspace.yaml` - Workspace root declaring apps/* and packages/*
- `turbo.json` - Build/dev/lint/test task orchestration with dependsOn
- `biome.json` - Biome 2.4.8 linter + formatter (tab indent, 100px line width)
- `apps/web/package.json` - Next.js 16, next-auth@beta, shadcn deps, workspace links
- `apps/web/next.config.ts` - transpilePackages for workspace packages, standalone output
- `apps/web/app/globals.css` - reco brand CSS tokens + inlined shadcn/tw-animate keyframes
- `apps/web/Dockerfile` - Multi-stage node:22-alpine build for standalone Next.js
- `packages/types/src/auth.ts` - UserRole, USER_ROLES, next-auth module augmentation
- `packages/types/src/tenant.ts` - DomainContext, TenantContext
- `.env.example` - DATABASE_URL, AUTH_SECRET, Entra ID, Resend, domain mode vars
- `.npmrc` - Hoist tw-animate-css and shadcn to root node_modules

## Decisions Made

- Used `next-auth@beta` (v5.0.0-beta.30) — `latest` tag is still v4; v5 needed for App Router `auth()` API
- Inlined `shadcn/tailwind.css` and `tw-animate-css` CSS content directly in `globals.css` — Turbopack 16.2.0 on Windows cannot resolve packages that export CSS only via the `"style"` export condition
- Removed `turbopack.root` override from `next.config.ts` — Windows absolute paths are not yet implemented in Turbopack's `resolveAlias`, causing the root config to break CSS resolution
- Biome 2.x `organizeImports` moved to `assist.actions.source.organizeImports`; `files.ignore` replaced by `files.includes` negation patterns without `/**`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Biome 2.x schema breaking changes**
- **Found during:** Post-Task-2 verification (biome check)
- **Issue:** `biome.json` used Biome 1.x schema keys (`organizeImports` at root, `files.ignore`) — not valid in Biome 2.4.8
- **Fix:** Updated schema URL to 2.4.8, moved organizeImports to `assist.actions.source`, replaced `files.ignore` with `files.includes` negation patterns
- **Files modified:** `biome.json`
- **Verification:** `pnpm biome check .` passes with 0 errors
- **Committed in:** `cf6c448`

**2. [Rule 3 - Blocking] Turbopack CSS import limitation on Windows**
- **Found during:** Task 2 verification (turbo build)
- **Issue:** `@import "shadcn/tailwind.css"` and `@import "tw-animate-css"` in globals.css failed — Turbopack does not resolve CSS packages with `"style"` export condition, and Windows absolute paths in `resolveAlias` are "not implemented yet"
- **Fix:** Inlined the CSS content of both packages directly into `globals.css`, removing the external `@import` statements
- **Files modified:** `apps/web/app/globals.css`, `apps/web/next.config.ts`
- **Verification:** `pnpm turbo build` passes, Route `/` generates as static
- **Committed in:** `454f15b`

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were required for the build to pass. The inlined CSS approach is functionally identical to importing the packages — no content is missing.

## Issues Encountered

- pnpm was not installed on the system — installed globally via `npm install -g pnpm` before proceeding
- Turbopack workspace root warning (picks up `C:\Users\BragiHallsson\package-lock.json`) — cosmetic only; resolved by inlining CSS packages rather than configuring `turbopack.root`

## User Setup Required

None - no external service configuration required at this stage. Environment variables documented in `.env.example`.

## Next Phase Readiness

- Monorepo fully buildable, workspace linking verified
- @repo/types exports UserRole and TenantContext — consumed by auth (plan 01-03) and routing (plan 01-04)
- @repo/db barrel export ready to receive Drizzle schema in plan 01-02
- Dockerfile ready for containerisation after plans 01-02 through 01-05 complete
- Biome config established — all subsequent plans inherit linting/formatting rules

---
*Phase: 01-infrastructure-foundation*
*Completed: 2026-03-20*
