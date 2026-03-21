---
phase: 09-notifications-and-manuals
plan: 01
subsystem: schema
tags: [notifications, manual-pages, rls, drizzle, migration, supabase-realtime]
dependency_graph:
  requires: [09-00]
  provides: [notification-schema, manual-pages-schema, notification-helpers]
  affects: [09-02, 09-03, 09-04, 09-05, 09-06]
tech_stack:
  added: [supabase-realtime-publication]
  patterns: [restrictive-base-deny-all, per-role-rls-policies, check-constraint-critical-types]
key_files:
  created:
    - packages/db/src/schema/manual-pages.ts
    - packages/db/migrations/0008_notifications_manuals.sql
    - apps/web/lib/notifications.ts
  modified:
    - packages/db/src/schema/notifications.ts
    - packages/db/src/schema/index.ts
decisions:
  - "notificationMutePreferences CHECK constraint on notification_type enforces critical-type immutability at DB layer — 4 critical types cannot be inserted into mute_preferences"
  - "manualContextEnum ('client'|'prison') scopes pages to role groups at RLS layer — no application-layer filter needed"
  - "isCritical() uses readonly string[] cast for includes() — avoids TypeScript tuple narrowing issues while keeping type safety for CalledWith patterns"
  - "Supabase Realtime publication added for notifications table — enables real-time in-app bell updates in Phase 9 UI plans"
metrics:
  duration_seconds: 149
  completed_date: "2026-03-21"
  tasks_completed: 2
  files_changed: 5
requirements_satisfied: [NOTIF-01, NOTIF-02, NOTIF-03]
---

# Phase 9 Plan 01: Notification Infrastructure and Manual Content Schema Summary

Notification schema extended with client/prison RLS, mute preferences table with critical-type CHECK constraint, manual_pages/manual_page_versions tables, and notification helper library with type classification.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Extend notification schema and create manual_pages schema in Drizzle | 0f2fc82 | notifications.ts, manual-pages.ts, index.ts |
| 2 | Create migration SQL and notification helper library | 6afc1da | 0008_notifications_manuals.sql, lib/notifications.ts |

## What Was Built

### Extended Notifications Schema (`packages/db/src/schema/notifications.ts`)

Added four new RLS policies to the existing `notifications` table:
- `notifications_client_read`: client_role SELECT own via JWT sub
- `notifications_client_update_read`: client_role UPDATE own (mark as read)
- `notifications_prison_read`: prison_role SELECT own via JWT sub
- `notifications_prison_update_read`: prison_role UPDATE own (mark as read)

Added `notificationMutePreferences` table (`notification_mute_preferences`):
- Full CRUD RLS for client_role, transport_role, prison_role (own rows only)
- reco_admin full CRUD
- Deny-all restrictive base policy

### Manual Pages Schema (`packages/db/src/schema/manual-pages.ts`)

- `manualContextEnum`: 'client' | 'prison' — determines which user group sees the page
- `manualPages`: context, slug, title, content_md, published, display_order, updated_by
  - RLS: reco_admin full CRUD; client_role sees client+published; prison_role sees prison+published
- `manualPageVersions`: immutable history snapshots per manual_page_id
  - RLS: reco_admin SELECT+INSERT only

### Migration SQL (`packages/db/migrations/0008_notifications_manuals.sql`)

Complete DDL for all new tables with:
- ENABLE + FORCE RLS on all three new tables
- 14 RLS policies on notification_mute_preferences (deny-all + 13 role policies)
- 4 new policies extending notifications for client + prison roles
- 4 RLS policies on manual_pages
- 3 RLS policies on manual_page_versions
- Audit trigger on manual_pages (reuses existing audit_log_trigger())
- Supabase Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`
- CHECK constraint: `notification_type NOT IN ('discrepancy_detected', 'uninvoiced_delivery', 'defective_batch_match', 'facility_inactive')`
- GRANTs to all relevant roles
- 4 performance indexes

### Notification Helper Library (`apps/web/lib/notifications.ts`)

Pure TypeScript constants — no DB imports:
- `CRITICAL_NOTIFICATION_TYPES`: 4 types that cannot be muted
- `NON_CRITICAL_NOTIFICATION_TYPES`: 10 operational notification types
- `CriticalNotificationType`, `NonCriticalNotificationType`, `NotificationType` type aliases
- `isCritical(type: string): boolean` — O(n) array lookup, n=4
- `NOTIFICATION_TYPE_LABELS`: human-readable labels for all 14 types

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. This plan is schema-only — no UI rendering stubs.

## Self-Check

### Files created/modified:
- [x] `packages/db/src/schema/notifications.ts` — FOUND (modified)
- [x] `packages/db/src/schema/manual-pages.ts` — FOUND (created)
- [x] `packages/db/src/schema/index.ts` — FOUND (modified)
- [x] `packages/db/migrations/0008_notifications_manuals.sql` — FOUND (created)
- [x] `apps/web/lib/notifications.ts` — FOUND (created)

### Commits:
- [x] `0f2fc82` — feat(09-01): extend notification schema and create manual-pages schema
- [x] `6afc1da` — feat(09-01): create migration SQL and notification helper library

### Acceptance criteria verified:
- [x] notifications.ts contains `notifications_client_read`
- [x] notifications.ts contains `notifications_prison_read`
- [x] notifications.ts contains `notificationMutePreferences`
- [x] manual-pages.ts contains `manualPages`
- [x] manual-pages.ts contains `manualPageVersions`
- [x] manual-pages.ts contains `manualContextEnum`
- [x] index.ts contains `export * from './manual-pages'`
- [x] packages/db TypeScript compilation: no errors
- [x] 0008_notifications_manuals.sql contains `notification_mute_preferences`
- [x] 0008_notifications_manuals.sql contains `manual_pages`
- [x] 0008_notifications_manuals.sql contains `manual_page_versions`
- [x] 0008_notifications_manuals.sql contains `supabase_realtime ADD TABLE notifications`
- [x] 0008_notifications_manuals.sql contains `CHECK (notification_type NOT IN`
- [x] 0008_notifications_manuals.sql contains `notifications_client_read`
- [x] 0008_notifications_manuals.sql contains `notifications_prison_read`
- [x] lib/notifications.ts contains `CRITICAL_NOTIFICATION_TYPES`
- [x] lib/notifications.ts contains `NON_CRITICAL_NOTIFICATION_TYPES`
- [x] lib/notifications.ts contains `export function isCritical`
- [x] lib/notifications.ts contains `NOTIFICATION_TYPE_LABELS`
- [x] apps/web TypeScript: no errors in notifications.ts (pre-existing errors in unrelated files are out of scope)

## Self-Check: PASSED
