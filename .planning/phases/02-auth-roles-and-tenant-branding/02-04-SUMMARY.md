---
phase: 02-auth-roles-and-tenant-branding
plan: "04"
subsystem: branding-ui
tags: [branding, wcag, settings, server-actions, live-preview]
dependency_graph:
  requires: [02-03]
  provides: [branding-config-ui, wcag-contrast-validation]
  affects: [settings-page]
tech_stack:
  added: [wcag-contrast@3.0.0]
  patterns: [upsert-on-conflict, css-variable-live-preview, server-action-return-value]
key_files:
  created:
    - apps/web/lib/contrast.ts
    - apps/web/types/wcag-contrast.d.ts
    - apps/web/app/(ops)/settings/branding-tab.tsx
    - apps/web/app/(ops)/settings/branding-form.tsx
  modified:
    - apps/web/app/(ops)/settings/actions.ts
    - apps/web/app/(ops)/settings/page.tsx
    - apps/web/package.json
    - pnpm-lock.yaml
decisions:
  - "wcag-contrast score() returns 'Fail' not 'DNP' — plan was incorrect; both 'Fail' and 'AA Large' rejected since AA Large only passes for large text, not normal body text"
  - "Type declaration added at apps/web/types/wcag-contrast.d.ts — package has no bundled TypeScript types"
  - "hex(a, b) returns numeric ratio; score(ratio) classifies — two-step call required per actual library API"
metrics:
  duration_seconds: 341
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_changed: 8
---

# Phase 02 Plan 04: Branding Configuration UI Summary

**One-liner:** Branding tab on settings page with live CSS-variable preview, WCAG AA rejection using wcag-contrast hex()+score(), and saveBranding Server Action upsert.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | WCAG contrast helper and branding Server Actions | e127dfa | contrast.ts, wcag-contrast.d.ts, actions.ts, package.json, pnpm-lock.yaml |
| 2 | Branding tab with live preview, integrate into settings page | 3ca317f | branding-tab.tsx, branding-form.tsx, page.tsx |

## What Was Built

### apps/web/lib/contrast.ts
`checkBrandingContrast(pairs)` — takes `{ fg, bg, label }` array, calls `hex(fg, bg)` for ratio then `score(ratio)`. Rejects `'Fail'` (< 3:1) and `'AA Large'` (3–4.5:1) since both fail WCAG AA for normal text. Returns `null` on pass or a human-readable error string with the actual ratio.

### apps/web/app/(ops)/settings/actions.ts (extended)
Three new Server Actions, all gated behind `requireRecoAdmin()`:
- `getTenants()` — active tenants ordered by name
- `getBranding(tenantId)` — single branding record or null
- `saveBranding(data)` — Zod validation, WCAG AA contrast check (bg/fg + bg/primary pairs), then `INSERT ... ON CONFLICT DO UPDATE` on `tenant_branding.tenant_id`

### apps/web/app/(ops)/settings/branding-tab.tsx
Thin server component that awaits `getTenants()` and passes list to `BrandingForm`.

### apps/web/app/(ops)/settings/branding-form.tsx
Client component (~300 lines):
- Tenant dropdown — on change calls `getBranding()` and populates fields
- Colour fields: hex text input + colour swatch div with `backgroundColor: value` for immediate visual feedback; inline validation error on invalid hex
- Font fields: `<select>` from `ALLOWED_FONTS`
- Live preview panel: `<div style={previewStyle}>` where `previewStyle` is CSS variable object (`--primary`, `--background`, `--foreground`, etc.) computed from current form values — updates on every keystroke
- Save calls `saveBranding()`; `result.error` (WCAG AA failure message) rendered in red alert box; `result.success` shows green confirmation

### apps/web/app/(ops)/settings/page.tsx (extended)
Added `Branding` TabsTrigger and TabsContent after the existing Users tab.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] wcag-contrast API differs from plan specification**
- **Found during:** Task 1 — reading actual library source
- **Issue:** Plan specified `score(fg, bg)` returning `'DNP'` for failures. Actual API: `score()` takes a single numeric contrast ratio (not two colours), and returns `'Fail'` (not `'DNP'`). The plan's interface description was incorrect.
- **Fix:** Used two-step call: `const ratio = hex(fg, bg); const result = score(ratio)`. Reject both `'Fail'` (< 3:1) and `'AA Large'` (3–4.5:1) since both fail WCAG AA 4.5:1 requirement for normal text.
- **Files modified:** apps/web/lib/contrast.ts
- **Commit:** e127dfa

**2. [Rule 2 - Missing] wcag-contrast has no TypeScript types**
- **Found during:** Task 1 — TypeScript compilation
- **Issue:** Package ships no `.d.ts` files; `tsc --noEmit` errored with TS7016 implicit any.
- **Fix:** Created `apps/web/types/wcag-contrast.d.ts` with typed declarations for `luminance`, `rgb`, `hex`, and `score`.
- **Files modified:** apps/web/types/wcag-contrast.d.ts
- **Commit:** e127dfa

## Self-Check: PASSED

All files confirmed on disk; both commits confirmed in git log.
