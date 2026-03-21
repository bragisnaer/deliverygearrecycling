---
phase: 09-notifications-and-manuals
plan: "03"
subsystem: notifications-ui
tags:
  - notifications
  - realtime
  - bell
  - mute-preferences
dependency_graph:
  requires:
    - 09-01  # notification helper library (isCritical, NOTIFICATION_TYPE_LABELS, schema)
    - 09-02  # email notifications (shared patterns)
  provides:
    - in-app notification bell with live badge in all portal headers
    - /notifications page with full paginated list and mute preferences
    - shared Server Actions at apps/web/lib/notification-actions.ts
  affects:
    - apps/web/app/(ops)/layout.tsx
    - apps/web/app/(client)/layout.tsx
    - apps/web/app/prison/layout.tsx
tech_stack:
  added: []
  patterns:
    - NotificationBell as client component with Supabase Realtime subscription via postgres_changes
    - Server Actions in lib/ (not route group) for zero cross-portal coupling
    - withRLSContext wrapping all notification DB queries
    - initialCount + initialNotifications server-rendered, live updates via realtime
key_files:
  created:
    - apps/web/lib/notification-actions.ts
    - apps/web/components/notification-bell.tsx
    - apps/web/components/notification-list.tsx
    - apps/web/app/(ops)/notifications/page.tsx
  modified:
    - apps/web/app/(ops)/ops-nav-bar.tsx
    - apps/web/app/(ops)/layout.tsx
    - apps/web/app/(client)/layout.tsx
    - apps/web/app/prison/layout.tsx
decisions:
  - "Server Actions placed in apps/web/lib/notification-actions.ts (not a route group) so ops, client, and prison portals all import from @/lib/notification-actions without cross-portal coupling"
  - "require('@supabase/supabase-js') used inside useEffect instead of top-level import — avoids SSR issues with the client-only Supabase JS package"
  - "NotificationBell gracefully skips Realtime subscription when NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY env vars are not set"
  - "NON_CRITICAL_NOTIFICATION_TYPES only shown in mute preferences section — critical types have no mute control per NOTIF-02"
metrics:
  duration_seconds: 260
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 8
---

# Phase 09 Plan 03: Notification Centre UI Summary

**One-liner:** In-app notification bell with Supabase Realtime live-badge, shared Server Actions in `lib/`, and per-type mute controls gated by `isCritical` guard across all three portals.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Shared notification Server Actions and NotificationBell component | e7c203b | notification-actions.ts, notification-bell.tsx |
| 2 | Notification list page, mute settings, and bell integration in all layouts | 9c09a8d | notification-list.tsx, notifications/page.tsx, ops-nav-bar.tsx, (ops)/layout.tsx, (client)/layout.tsx, prison/layout.tsx |

## What Was Built

### `apps/web/lib/notification-actions.ts`

Shared `'use server'` file providing seven Server Actions:
- `getUnreadCount()` — counts unread notifications for the authenticated user via `withRLSContext`
- `getRecentNotifications(limit)` — fetches N most recent notifications ordered by `created_at DESC`
- `getNotifications(page, pageSize)` — paginated list with separate `count()` query, returns `{ items, total }`
- `markNotificationRead(id)` — sets `read = true` for a specific notification, revalidates `/notifications`
- `markAllRead()` — bulk UPDATE unread notifications for the user, revalidates `/notifications`
- `saveMutePreference(type, muted)` — upserts into `notificationMutePreferences` with `isCritical` guard that throws on critical types
- `getMutePreferences()` — returns all mute preference rows for the user

### `apps/web/components/notification-bell.tsx`

Client component rendered in all portal headers:
- Bell icon with absolute-positioned red badge showing unread count (hidden at zero)
- Click opens dropdown (w-80, shadow-lg, z-50) showing most recent 5 notifications
- Each notification shows: unread dot indicator, title, truncated body, relative time
- Click on notification: marks read via Server Action, navigates to entity URL if entity_type/entity_id present
- "Mark all read" button in dropdown header
- "View all notifications" footer link to `/notifications`
- Supabase Realtime `postgres_changes` subscription filtered by `user_id=eq.{userId}` — increments badge and prepends new notification to list on INSERT events, calls `toast(title)` for toast notification
- Click-outside handler closes dropdown

### `apps/web/components/notification-list.tsx`

Client component for the full `/notifications` page:
- Paginated list of all notifications with Previous/Next page links
- "Mark all as read" button at top
- Each row: unread dot, bold title (unread), body (2-line clamp), relative timestamp
- Mute preferences section lists only `NON_CRITICAL_NOTIFICATION_TYPES` — critical types (discrepancy_detected, uninvoiced_delivery, defective_batch_match, facility_inactive) have no mute control
- Toggle switch for each non-critical type: checked = receiving (not muted), unchecked = muted
- `saveMutePreference` called on toggle change

### Layout integrations

- **Ops layout:** Bell positioned after `OpsNavBar` in flex `items-center gap-4` wrapper
- **Client layout:** Bell added inside existing `<nav>` alongside Overview, Pickups, new Manual links
- **Prison layout:** Bell replaces the previous `<span className="w-[60px]" />` spacer at right side of header
- **Ops nav bar:** Manuals link added between ESG and Products pointing to `/manual-editor`

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- FOUND: apps/web/lib/notification-actions.ts
- FOUND: apps/web/components/notification-bell.tsx
- FOUND: apps/web/components/notification-list.tsx
- FOUND: apps/web/app/(ops)/notifications/page.tsx

Commits exist:
- e7c203b: feat(09-03): add shared notification Server Actions and NotificationBell component
- 9c09a8d: feat(09-03): add notification list page, mute preferences, and integrate bell into all portal layouts

TypeScript compilation: PASSED (zero errors)
