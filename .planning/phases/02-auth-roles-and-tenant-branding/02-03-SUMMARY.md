---
phase: 02-auth-roles-and-tenant-branding
plan: "03"
subsystem: tenant-branding
tags: [drizzle, rls, css-variables, branding, client-portal]
dependency_graph:
  requires: [01-infrastructure-foundation]
  provides: [tenant-branding-schema, branding-css-injection]
  affects: [apps/web/app/(client)/layout.tsx]
tech_stack:
  added: []
  patterns: [css-custom-properties, hex-validation, font-allowlist, rls-deny-all-base]
key_files:
  created:
    - packages/db/src/schema/branding.ts
    - apps/web/lib/branding.ts
  modified:
    - packages/db/src/schema/index.ts
    - apps/web/app/(client)/layout.tsx
decisions:
  - "getBrandingForTenant uses raw db client (no RLS context) — branding is non-sensitive and needed before auth context on sign-in pages"
  - "buildBrandingStyle returns undefined (not empty object) when no overrides — React omits style prop entirely, reco :root defaults apply automatically"
  - "Font allowlist (ALLOWED_FONTS) prevents arbitrary CSS injection; system-ui excluded from Google Fonts fetch"
metrics:
  duration: 4
  completed_date: "2026-03-20T14:36:20Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 02 Plan 03: Tenant Branding Schema and CSS Variable Injection Summary

**One-liner:** Per-tenant branding via Drizzle tenant_branding table with RLS and CSS custom property injection into the client portal layout, with HEX validation and font allowlist.

## What Was Built

- `packages/db/src/schema/branding.ts`: `tenant_branding` table with all BRAND-01 fields (logo_url, favicon_url, primary_color, secondary_color, background_color, foreground_color, accent_color, heading_font, body_font — all nullable), unique FK to tenants.id, and RLS matching the project deny-all pattern (reco-admin full CRUD, reco SELECT, client SELECT own tenant)
- `apps/web/lib/branding.ts`: Helper library exporting `getBrandingForTenant` (Drizzle query), `buildBrandingStyle` (HEX-validated CSS vars object), `getGoogleFontUrls` (dynamic Google Fonts URLs), `HEX_REGEX`, and `ALLOWED_FONTS`
- `apps/web/app/(client)/layout.tsx`: Server component updated to fetch branding, inject `style={brandingStyle}` on wrapper div, render logo when present, and load Google Font `<link>` tags for non-system fonts

## Decisions Made

1. **Raw db client for branding fetch**: `getBrandingForTenant` uses the raw db client without RLS context. Branding is non-sensitive public data and may be needed on sign-in pages before the auth context (JWT claims) is established.

2. **`undefined` return for no-branding case**: `buildBrandingStyle` returns `undefined` rather than an empty object when branding is null or all fields are null. React omits the `style` prop entirely, so `:root` reco defaults apply with zero runtime overhead.

3. **Font allowlist prevents injection**: Rather than accepting arbitrary font strings, `ALLOWED_FONTS` is a const tuple. Only listed fonts pass through to CSS vars or Google Fonts URLs. `system-ui` is on the allowlist but excluded from Google Fonts fetch.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create tenant_branding schema with RLS | 0704c05 | packages/db/src/schema/branding.ts, packages/db/src/schema/index.ts |
| 2 | Build branding helper library and inject CSS vars | bed97c3 | apps/web/lib/branding.ts, apps/web/app/(client)/layout.tsx |

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Satisfied

- BRAND-01: tenant_branding table with all nullable fields
- BRAND-02: HEX validation before injection; font allowlist
- BRAND-03: No hardcoded hex colours in component files (verified: 0 matches)
- BRAND-04: No branding record = no style prop = reco defaults from :root apply

## Self-Check: PASSED

- packages/db/src/schema/branding.ts: FOUND
- apps/web/lib/branding.ts: FOUND
- Commit 0704c05: FOUND
- Commit bed97c3: FOUND
