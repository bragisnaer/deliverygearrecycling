---
phase: 09-notifications-and-manuals
plan: "04"
subsystem: manual-editor
tags: [manual, cms, reco-admin, versioning, markdown]
dependency_graph:
  requires: [09-01]
  provides: [manual-editor-crud]
  affects: [09-05]
tech_stack:
  added: []
  patterns:
    - Server Actions with withRLSContext for reco-admin CRUD
    - Version snapshot pattern (INSERT before UPDATE on content change)
    - Client components in separate files from Server Component pages
    - Auto-slug generation from title with manual override
key_files:
  created:
    - apps/web/app/(ops)/manual-editor/actions.ts
    - apps/web/app/(ops)/manual-editor/page.tsx
    - apps/web/app/(ops)/manual-editor/new/page.tsx
    - apps/web/app/(ops)/manual-editor/new/create-page-form.tsx
    - apps/web/app/(ops)/manual-editor/[id]/page.tsx
    - apps/web/app/(ops)/manual-editor/[id]/manual-page-editor.tsx
  modified: []
decisions:
  - Plain-text pre block used for preview instead of ReactMarkdown — react-markdown not yet installed; Plan 05 replaces with full rendering
  - params awaited as Promise<{ id: string }> in [id]/page.tsx — Next.js App Router async params pattern
metrics:
  duration_seconds: 148
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_created: 6
  files_modified: 0
---

# Phase 09 Plan 04: Manual Editor Summary

Manual editor CRUD with version snapshots, publish toggle, and version history restore for reco-admin, backed by the manual_pages and manual_page_versions schema from Plan 01.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create manual editor Server Actions | `86c2b6d` | actions.ts |
| 2 | Create manual editor UI pages and client components | `9f09d2b` | page.tsx, new/page.tsx, new/create-page-form.tsx, [id]/page.tsx, [id]/manual-page-editor.tsx |

## What Was Built

**Server Actions (`actions.ts`):**
- `getManualPages()` — all pages ordered by context, display_order, title
- `getManualPage(id)` — single page by ID
- `createManualPage(data)` — insert with slug validation (`/^[a-z0-9-]+$/`)
- `saveManualPage(id, contentMd, title)` — creates version snapshot if content changed, then updates
- `togglePublish(id, published)` — flips published flag, revalidates `/manual` client-facing route
- `getVersionHistory(manualPageId)` — last 20 versions ordered by saved_at DESC
- `deleteManualPage(id)` — hard delete (cascades to versions via FK)
- `getAdminUser()` helper enforces `reco-admin` role on every action

**UI Pages:**
- `/manual-editor` — index listing all pages in two sections (Client Manual, Prison Manual) with title, slug, published badge, display_order, updated_at
- `/manual-editor/new` — create form with context selector, title input, auto-slug (editable), error display
- `/manual-editor/[id]` — edit page with two-column layout: markdown textarea (left) + plain-text preview (right), save/publish/delete buttons, toggleable version history panel with restore

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

**1. Plain-text preview in ManualPageEditor**
- File: `apps/web/app/(ops)/manual-editor/[id]/manual-page-editor.tsx`, line 131
- Stub: `<pre>` block renders raw markdown text instead of rendered HTML
- Reason: `react-markdown` not yet installed in this codebase
- Resolution: Plan 05 installs react-markdown and replaces the `<pre>` with `<ReactMarkdown>` (intentional per plan spec)

This stub does NOT prevent the plan goal from being achieved — reco-admin can create, edit, save, version, and publish pages; the preview is functional (shows content), just unrendered.

## Self-Check: PASSED

All 6 files found on disk. Both commits (86c2b6d, 9f09d2b) verified in git log.
