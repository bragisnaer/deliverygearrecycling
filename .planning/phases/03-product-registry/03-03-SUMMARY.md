---
phase: 03-product-registry
plan: "03"
subsystem: ops-ui
tags: [products, server-actions, photo-upload, react-hook-form, rls, next-auth]
dependency_graph:
  requires: [03-01, 03-02]
  provides: [product-list-ui, product-detail-ui, product-server-actions]
  affects: [03-04]
tech_stack:
  added: []
  patterns:
    - withRLSContext with JWTClaims sub mapped from session.user.id
    - OpsNavBar client component for usePathname-based active nav in server layout
    - react-hook-form + zod in ProductForm with FormData bridge to Server Actions
    - Drag-and-drop upload with useTransition for non-blocking photo uploads
key_files:
  created:
    - apps/web/app/(ops)/products/actions.ts
    - apps/web/app/(ops)/products/page.tsx
    - apps/web/app/(ops)/products/new/page.tsx
    - apps/web/app/(ops)/products/[id]/page.tsx
    - apps/web/app/(ops)/products/components/product-form.tsx
    - apps/web/app/(ops)/products/components/product-photo-upload.tsx
    - apps/web/app/(ops)/ops-nav-bar.tsx
  modified:
    - apps/web/app/(ops)/layout.tsx
decisions:
  - "OpsNavBar extracted as client component — usePathname() requires 'use client'; layout stays Server Component for requireAuth"
  - "session.user.id mapped to JWTClaims.sub — next-auth stores token.sub as session.user.id; withRLSContext requires sub field"
  - "product_code uniqueness in createProduct relies on RLS policy scoping query to tenant automatically — no explicit tenant_id filter needed in app layer"
  - "pnpm --filter web build fails with pre-existing middleware.ts/proxy.ts conflict — confirmed pre-existing before plan 03-03; tsc --noEmit passes cleanly"
metrics:
  duration: "7 minutes"
  completed: "2026-03-20T16:01:33Z"
  tasks: 2
  files: 8
---

# Phase 03 Plan 03: Product Registry UI Summary

Product list page, product detail page, create/edit form, and photo upload UI with drag-and-drop. Products nav link added to ops portal. Six Server Actions with auth guards, RLS context, and photo storage integration.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Product Server Actions and ops nav update | c015563 | layout.tsx, ops-nav-bar.tsx, products/actions.ts |
| 2 | Product list, detail, form, photo upload | 95098b0 | page.tsx, [id]/page.tsx, new/page.tsx, product-form.tsx, product-photo-upload.tsx |

## What Was Built

**Ops Nav Bar** — `OpsNavBar` client component renders Dashboard/Products/Settings links with active-path underline via `usePathname()`. The server layout `requireAuth()` guard is preserved.

**Product Server Actions** — Six actions in `products/actions.ts`:
- `getProducts()` — RLS-scoped select, ordered by name
- `getProduct(id)` — single product with signed photo URLs from Supabase Storage (1h expiry)
- `createProduct(formData)` — zod validation, product_code uniqueness check, INSERT with tenant_id
- `updateProduct(id, formData)` — same validation, uniqueness check excluding self, UPDATE
- `uploadProductPhoto(productId, formData)` — 5MB + image-type validation, 5-photo limit, uploads to `{tenant_id}/products/{id}/photos/`
- `deleteProductPhoto(productId, filePath)` — path prefix validation before remove

**Product List Page** — Server component table with Name, Code, Group, Stream, Weight, Status (Badge), Edit link. Empty state with CTA.

**Product Detail Page** — Four sections: ProductForm (edit mode), ProductPhotoUpload, "Material Composition" placeholder, "Pricing" placeholder.

**ProductForm** — react-hook-form + zod, all fields (name, code, group, processing_stream select, description textarea, weight, active checkbox). Submits via FormData bridge to Server Actions. Toast on success/error. Redirects to `/products/[id]` on create.

**ProductPhotoUpload** — Drag-and-drop zone with `onDragOver/onDragEnter/onDragLeave/onDrop`. `grid-cols-2 md:grid-cols-3` thumbnail grid. Click-to-enlarge via `@base-ui/react/dialog`. X button overlay with confirmation. `useTransition` for non-blocking uploads. Photo count indicator.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JWTClaims.sub not present on session.user**
- **Found during:** Task 1 (tsc --noEmit)
- **Issue:** `withRLSContext` requires `JWTClaims` with `sub` field; next-auth `session.user` has `id` (= token.sub) but not `sub`
- **Fix:** Helper functions `requireRecoAdmin()` and `getSessionClaims()` spread `session.user` and add `sub: user.id!`
- **Files modified:** apps/web/app/(ops)/products/actions.ts
- **Commit:** c015563

**2. [Out of scope - Pre-existing] pnpm --filter web build fails**
- **Found during:** Task 2 verification
- **Issue:** `Both middleware file ./middleware.ts and proxy file ./proxy.ts are detected` — Next.js 16.2 regression; confirmed present before plan 03-03 via git stash test
- **Action:** Logged to deferred-items; tsc --noEmit used as verification instead (passes cleanly)
- **Commit:** N/A — not introduced by this plan

## Self-Check: PASSED

Files exist:
- apps/web/app/(ops)/products/actions.ts — FOUND
- apps/web/app/(ops)/products/page.tsx — FOUND
- apps/web/app/(ops)/products/new/page.tsx — FOUND
- apps/web/app/(ops)/products/[id]/page.tsx — FOUND
- apps/web/app/(ops)/products/components/product-form.tsx — FOUND
- apps/web/app/(ops)/products/components/product-photo-upload.tsx — FOUND
- apps/web/app/(ops)/ops-nav-bar.tsx — FOUND

Commits:
- c015563 — FOUND (Task 1)
- 95098b0 — FOUND (Task 2)
