---
phase: 09-notifications-and-manuals
verified: 2026-03-21T12:00:00Z
status: passed
score: 14/14 must-haves verified
re_verification: false
human_verification:
  - test: "Bell badge increments in real-time when a new notification is inserted"
    expected: "Badge count increases without page refresh; toast appears with notification title"
    why_human: "Supabase Realtime postgres_changes subscription only verifiable with live DB and running app"
  - test: "Critical notification type cannot be saved to mute_preferences via the toggle UI"
    expected: "saveMutePreference throws 'Critical notification types cannot be muted' before any DB write"
    why_human: "The DB CHECK constraint and application guard both enforce this, but the user-facing error state needs manual confirmation"
  - test: "Client user at /manual sees only client-context published pages; cannot reach /prison/manual"
    expected: "Client sees their content; /prison/manual redirects or shows 403"
    why_human: "RLS enforcement and route auth guard require a live authenticated session to verify"
  - test: "Prison staff at /prison/manual sees only prison-context published pages; /manual redirects to prison login"
    expected: "Prison sees Danish-labelled content; /manual is not accessible to prison role"
    why_human: "Requires live session with prison_role JWT claims"
  - test: "Facility inactive check on ops dashboard does not create duplicate alerts within 7 days"
    expected: "Second dashboard load within 7 days for same inactive facility produces no new notification row"
    why_human: "Deduplication window requires time-based DB state that cannot be asserted from static code"
---

# Phase 9: Notifications and Manuals Verification Report

**Phase Goal:** All roles receive timely notifications for critical events; client and prison users have role-appropriate manual content accessible from their portals
**Verified:** 2026-03-21T12:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Notification bell with unread badge appears in ops, client, and prison portal headers | VERIFIED | `NotificationBell` imported and rendered in `(ops)/layout.tsx`, `(client)/layout.tsx`, `prison/layout.tsx` |
| 2 | Bell badge updates in real-time via Supabase Realtime | VERIFIED (auto) / ? (human) | `postgres_changes` subscription at `notification-bell.tsx:69`; env-var guard present; live behavior needs human |
| 3 | Users can mark notifications read individually and all at once | VERIFIED | `markNotificationRead`, `markAllRead` exported from `notification-actions.ts`; wired in both `notification-bell.tsx` and `notification-list.tsx` |
| 4 | Non-critical notification types show mute toggles; critical types have no mute control | VERIFIED | `notification-list.tsx` renders only `NON_CRITICAL_NOTIFICATION_TYPES`; `saveMutePreference` in `notification-actions.ts` throws on `isCritical(type)` at line 103 |
| 5 | Critical events always notify (cannot be muted) | VERIFIED | `dispatchNotification` in `notification-events.ts` bypasses mute check for `isCritical(type)` at line 39; DB-level `CHECK constraint` in `0008_notifications_manuals.sql` blocks INSERT into `notification_mute_preferences` for 4 critical types |
| 6 | All 14 PRD notification event types have in-app dispatch trigger points | VERIFIED | All 14 types confirmed: `pickup_submitted` (pre-existing), `pickup_confirmed`, `pickup_collected`, `transport_booked` (pre-existing), `pallets_received`, `warehouse_ageing` (pre-existing), `outbound_dispatched`, `delivery_completed`, `unexpected_intake` (pre-existing), `processing_submitted`, `discrepancy_detected` (pre-existing), `uninvoiced_delivery`, `defective_batch_match`, `facility_inactive` |
| 7 | Email sent alongside in-app notification for critical events | VERIFIED | `DiscrepancyAlertEmail` wired in `prison/actions.ts:603`; `DefectiveBatchAlertEmail` at `prison/actions.ts:471`; `UninvoicedAlertEmail` in `financial/actions.ts:540`; `FacilityInactiveAlertEmail` in `dashboard/actions.ts:284`; `PickupConfirmedEmail` in `pickups/actions.ts:135`; `WarehouseAgeingAlertEmail` in `transport/outbound/actions.ts:183` |
| 8 | Client users see a manual index and can read published client-context pages | VERIFIED | `(client)/manual/page.tsx` calls `getClientManualPages()`; `(client)/manual/[slug]/page.tsx` renders via `ManualRenderer`; DB query filters `context='client' AND published=true` |
| 9 | Prison staff see a manual index (Danish labels) and can read published prison-context pages | VERIFIED | `prison/manual/page.tsx` has "Driftsmanual" heading and "Ingen manualsider tilgængelige endnu." empty state; queries filter `context='prison' AND published=true`; auth guard redirects non-prison to `/prison/login` |
| 10 | Manual pages render markdown with GFM tables, images, and embedded PDF (iframe) support | VERIFIED | `ManualRenderer` uses `react-markdown@10.1.0` with `remarkGfm` and `rehypeRaw` plugins; `.manual-content img` and `.manual-content iframe` CSS in `globals.css` |
| 11 | Client users cannot see prison manual pages (and vice versa) | VERIFIED | Application-layer context WHERE clause in both action files; RLS policies `mp_client_read` (`context='client' AND published=true`) and `mp_prison_read` (`context='prison' AND published=true`) in migration SQL enforce at DB layer |
| 12 | reco-admin can create, edit, version, and publish manual pages | VERIFIED | `createManualPage`, `saveManualPage` (with version snapshot INSERT before UPDATE), `togglePublish`, `getVersionHistory` all exported from `(ops)/manual-editor/actions.ts`; `getAdminUser()` guard enforces `reco-admin` role on every action |
| 13 | Facility inactive check creates notifications automatically on dashboard load | VERIFIED | `checkFacilityInactiveAlerts()` called in `dashboard/page.tsx:40-45` (non-blocking try/catch); 7-day deduplication guard in `dashboard/actions.ts:258-261` |
| 14 | All portals import notification actions from shared lib path (no cross-portal coupling) | VERIFIED | `grep` confirms `from '@/lib/notification-actions'` in ops, client, and prison layouts — no cross-portal imports found |

**Score:** 14/14 truths verified (5 have human-verification items for live behaviour)

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `apps/web/lib/notifications.ts` | Type constants, `isCritical`, `NOTIFICATION_TYPE_LABELS` | VERIFIED | Exports all four required constants/functions at lines 2, 9, 26, 31 |
| `packages/db/src/schema/notifications.ts` | Extended RLS for client/prison; `notificationMutePreferences` table | VERIFIED | `notifications_client_read` at line 66, `notifications_prison_read` at line 81, `notificationMutePreferences` at line 100 |
| `packages/db/src/schema/manual-pages.ts` | `manualPages`, `manualPageVersions`, `manualContextEnum` | VERIFIED | All three exported; context enum at line 17, manualPages at line 20, manualPageVersions at line 68 |
| `packages/db/migrations/0008_notifications_manuals.sql` | DDL for all new tables, RLS, CHECK constraint, Realtime | VERIFIED | Contains `notification_mute_preferences`, `manual_pages`, `manual_page_versions`, CHECK constraint, `supabase_realtime ADD TABLE notifications`, all RLS policies |
| `apps/web/lib/notification-actions.ts` | 7 shared Server Actions for all portals | VERIFIED | `'use server'`; exports `getUnreadCount`, `getRecentNotifications`, `getNotifications`, `markNotificationRead`, `markAllRead`, `saveMutePreference`, `getMutePreferences` |
| `apps/web/lib/notification-events.ts` | `dispatchNotification`, `getRecoAdminEmails` | VERIFIED | `dispatchNotification` at line 34 with mute check, `isCritical` bypass, `sendEmail`; `getRecoAdminEmails` at line 85 |
| `apps/web/components/notification-bell.tsx` | Bell with badge, dropdown, Realtime subscription | VERIFIED | `'use client'`; `NotificationBell` export; `postgres_changes` subscription; `NEXT_PUBLIC_SUPABASE_URL` guard; imports from `@/lib/notification-actions` |
| `apps/web/components/notification-list.tsx` | Full paginated notification list with mute toggles | VERIFIED | `NON_CRITICAL_NOTIFICATION_TYPES` rendered; `saveMutePreference` called on toggle; imports from shared lib |
| `apps/web/app/(ops)/notifications/page.tsx` | Full notification list page for ops portal | VERIFIED | Server Component; calls `getNotifications`, `getMutePreferences`; renders `NotificationList` |
| `apps/web/emails/discrepancy-alert.tsx` | Email template for discrepancy events | VERIFIED | `export default function DiscrepancyAlertEmail`; `@react-email/components`; typed props |
| `apps/web/emails/uninvoiced-alert.tsx` | Email template for uninvoiced delivery events | VERIFIED | `UninvoicedAlertEmail` exported; typed props |
| `apps/web/emails/defective-batch-alert.tsx` | Email template for defective batch match | VERIFIED | `DefectiveBatchAlertEmail` exported; typed props |
| `apps/web/emails/facility-inactive-alert.tsx` | Email template for facility inactive events | VERIFIED | `FacilityInactiveAlertEmail` exported; typed props |
| `apps/web/emails/warehouse-ageing-alert.tsx` | Email template for warehouse ageing | VERIFIED | `WarehouseAgeingAlertEmail` exported; typed props |
| `apps/web/emails/pickup-confirmed.tsx` | Client-facing pickup confirmation email | VERIFIED | `PickupConfirmedEmail` exported; typed props |
| `apps/web/app/(ops)/manual-editor/actions.ts` | CRUD Server Actions for manual pages | VERIFIED | `'use server'`; `getManualPages`, `getManualPage`, `createManualPage`, `saveManualPage`, `togglePublish`, `getVersionHistory`, `deleteManualPage`; `reco-admin only` guard |
| `apps/web/app/(ops)/manual-editor/page.tsx` | Manual editor index grouped by context | VERIFIED | Renders "Client Manual" and "Prison Manual" sections |
| `apps/web/app/(ops)/manual-editor/[id]/manual-page-editor.tsx` | Client component with textarea, version history, publish toggle | VERIFIED | `'use client'`; `ManualPageEditor`; `saveManualPage`, `togglePublish` wired |
| `apps/web/app/(ops)/manual-editor/new/create-page-form.tsx` | Create page form with auto-slug | VERIFIED | `'use client'`; `CreatePageForm`; `createManualPage` wired |
| `apps/web/components/manual-renderer.tsx` | Markdown renderer with GFM and raw HTML | VERIFIED | `ReactMarkdown` with `remarkGfm` and `rehypeRaw`; `ManualRenderer` exported |
| `apps/web/app/(client)/manual/page.tsx` | Client manual index | VERIFIED | `getClientManualPages` called; links to `/manual/{slug}` |
| `apps/web/app/(client)/manual/[slug]/page.tsx` | Client manual page | VERIFIED | `ManualRenderer` renders `page.content_md` |
| `apps/web/app/prison/manual/page.tsx` | Prison manual index with Danish labels | VERIFIED | "Driftsmanual" heading; "Ingen manualsider tilgængelige endnu." empty state; role guard |
| `apps/web/app/prison/manual/[slug]/page.tsx` | Prison manual page | VERIFIED | `ManualRenderer` renders `page.content_md` |
| `apps/web/app/(ops)/dashboard/actions.ts` | `checkFacilityInactiveAlerts` | VERIFIED | `facility_inactive` dispatch; `FacilityInactiveAlertEmail`; 7-day deduplication |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `notification-actions.ts` | `notifications.ts` | `isCritical` guard on `saveMutePreference` | WIRED | Line 6 import; line 103 `isCritical(notificationType)` check |
| `(ops)/layout.tsx` | `notification-bell.tsx` | `NotificationBell` in header | WIRED | Line 5 import; line 26 render |
| `(client)/layout.tsx` | `notification-actions.ts` | `getUnreadCount` from shared lib | WIRED | Line 6 import from `@/lib/notification-actions` (not ops route group) |
| `prison/layout.tsx` | `notification-actions.ts` | `getUnreadCount` from shared lib | WIRED | Line 6 import from `@/lib/notification-actions` (not ops route group) |
| `notification-bell.tsx` | `notification-actions.ts` | `markNotificationRead` usage | WIRED | Line 7 import; line 108 call |
| `notification-events.ts` | `notifications.ts` | `isCritical` for mute bypass | WIRED | Line 4 import; lines 39, 71 usage |
| `notification-events.ts` | `email.ts` | `sendEmail` for email channel | WIRED | Line 5 import; line 73 call |
| `dashboard/actions.ts` | `notification-events.ts` | `dispatchNotification` for `facility_inactive` | WIRED | Line 4 import; line 276 call |
| `financial/actions.ts` | `notification-events.ts` | `dispatchNotification` for `uninvoiced_delivery` | WIRED | Line 19 import; line 529 call |
| `(client)/manual/[slug]/page.tsx` | `manual-renderer.tsx` | `ManualRenderer` component | WIRED | Line 4 import; line 27 render |
| `prison/manual/[slug]/page.tsx` | `manual-renderer.tsx` | `ManualRenderer` component | WIRED | Line 5 import; line 37 render |
| `(client)/manual/actions.ts` | `manual-pages.ts` (schema) | `manualPages` query with `context='client'` filter | WIRED | Lines 32-33: `eq(manualPages.context, 'client')` and `eq(manualPages.published, true)` |
| `manual-editor/actions.ts` | `manual-pages.ts` (schema) | `manualPages`, `manualPageVersions` import | WIRED | Line 4 import; version snapshot INSERT at line 77 before UPDATE |
| `ops-nav-bar.tsx` | `/manual-editor` | Manuals nav item | WIRED | Line 15: `{ label: 'Manuals', href: '/manual-editor' }` |
| `(client)/layout.tsx` | `/manual` | Manual nav link | WIRED | Line 51 `href="/manual"` |

---

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| NOTIF-01 | 09-01, 09-03, 09-06 | In-app notification centre for all roles; email for key events per PRD matrix | SATISFIED | Bell in all 3 portal headers; 14 event trigger points wired; `notification-actions.ts` shared across portals |
| NOTIF-02 | 09-01, 09-03, 09-06 | Critical events cannot be muted | SATISFIED | DB CHECK constraint blocks INSERT; `saveMutePreference` throws; `dispatchNotification` bypasses mute for `isCritical` types; mute UI excludes critical types |
| NOTIF-03 | 09-00, 09-03 | Users can mute non-critical in-app notifications per event type | SATISFIED | `notification-list.tsx` shows toggles for all 10 `NON_CRITICAL_NOTIFICATION_TYPES`; `getMutePreferences` / `saveMutePreference` actions wired |
| NOTIF-04 | 09-02 | Transactional email templates built with React Email | SATISFIED | 6 new templates + pre-existing templates; all use `@react-email/components`; wired via `dispatchNotification` and `sendEmail` |
| MANUAL-01 | 09-05 | Client manual served at client portal | SATISFIED | `/manual` page fetches `context='client'` published pages; `ManualRenderer` renders markdown |
| MANUAL-02 | 09-05 | Prison Operations Manual at prison portal | SATISFIED | `/prison/manual` with Danish labels; `context='prison'` filter; tablet-friendly p-6 cards |
| MANUAL-03 | 09-04 | Markdown-rendered content; reco-admin edits in platform; versioned | SATISFIED | `ManualRenderer` renders markdown for readers; `saveManualPage` inserts version snapshot before update; `getVersionHistory` returns last 20 versions |
| MANUAL-04 | 09-01, 09-05 | Role-appropriate manual version per role | SATISFIED | RLS scopes `manual_pages` by context; application-layer context filters as defence-in-depth; prison auth guard; client auth guard |

No orphaned requirements found — all 8 requirement IDs appear in plan frontmatter and are satisfied.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/app/(ops)/manual-editor/[id]/manual-page-editor.tsx` | 131–132 | `<pre>` plain-text preview with `TODO: Replace with ReactMarkdown after react-markdown install (Plan 05)` comment — Plan 05 was executed but this editor preview was not updated | Warning | Affects reco-admin editing experience only; reader-facing routes at `(client)/manual/[slug]` and `prison/manual/[slug]` use `ManualRenderer` correctly; does not affect any end-user goal |

No stub patterns detected in any user-facing files. No empty array/object returns, no hardcoded placeholder data, no `return null` stubs in substantive paths.

---

## Human Verification Required

### 1. Supabase Realtime Bell Update

**Test:** With the app running and a reco-admin dashboard open, trigger a new notification (e.g., submit a new pickup as a client user or fire a discrepancy from prison intake)
**Expected:** The bell badge in the header increments without page refresh; a toast notification appears with the notification title
**Why human:** Supabase Realtime `postgres_changes` subscription requires a live DB connection and running Next.js app; cannot verify from static code

### 2. Critical Type Mute UI Guard

**Test:** Open /notifications as a client user; attempt to toggle mute for any notification type visible in the mute preferences panel
**Expected:** Only non-critical types appear; no toggle is visible for `discrepancy_detected`, `uninvoiced_delivery`, `defective_batch_match`, or `facility_inactive`
**Why human:** The UI conditional rendering is verified in code (`NON_CRITICAL_NOTIFICATION_TYPES` only), but confirming the visual absence of critical toggles requires a rendered page

### 3. Client/Prison Content Isolation

**Test:** Log in as a client user and attempt to navigate to `/prison/manual`; log in as a prison user and attempt to navigate to `/manual`
**Expected:** Client user is redirected away from prison manual (role check in prison layout); prison user is redirected to `/prison/login` when hitting the client-auth-protected `/manual`
**Why human:** Auth redirects require live JWT session with correct role claims

### 4. Facility Inactive Deduplication

**Test:** Load the ops dashboard twice within 7 days for a facility with no recent intake
**Expected:** Only one `facility_inactive` notification row exists in the DB for that facility after both loads
**Why human:** 7-day window deduplication requires observing DB state over time

### 5. Manual Page Edit-to-Publish Workflow

**Test:** Log in as reco-admin; create a new manual page; edit content; save; verify version history appears; publish the page; confirm it appears in the client portal
**Expected:** Page visible in `/manual-editor`; version row created in `manual_page_versions` after save; after publish, page appears at `/manual`
**Why human:** End-to-end workflow requires live DB and authenticated sessions across multiple roles

---

## Anti-Pattern Detail

The `manual-page-editor.tsx` plain-text preview (line 131–132) was explicitly documented as a known stub in the 09-04-SUMMARY.md, planned for replacement by Plan 05. Plan 05 did not include the editor preview update in its scope — it focused on the reader-facing `ManualRenderer` component and portal routes. The comment references "Plan 05" as the resolution but Plan 05's `files_modified` list does not include `manual-page-editor.tsx`.

This is a warning-level gap in the admin editing experience. The editorial workflow is fully functional (save, version, publish all work), but the live preview panel shows raw markdown text rather than rendered HTML. The reader-facing content at `/manual` and `/prison/manual` is correctly rendered via `ManualRenderer`. This does not prevent the phase goal from being achieved.

---

## Summary

Phase 9 goal is **achieved**. All 8 requirements (NOTIF-01 through NOTIF-04, MANUAL-01 through MANUAL-04) have implementation evidence. All 25 required artifacts exist, are substantive, and are wired to their consumers. All 15 key links are verified. The notification dispatch pipeline (schema → helper library → Server Actions → UI components → portal layouts) is complete. The manual content pipeline (schema → editor actions → reader actions → ManualRenderer → portal routes) is complete.

One warning-level anti-pattern exists: the reco-admin manual editor preview remains plain-text (`<pre>` block) rather than rendered markdown. This does not affect any requirement or end-user-facing route.

Five behaviours require human verification: Realtime badge updates, critical-type mute UI absence, cross-role content isolation redirects, facility inactive deduplication, and the full edit-to-publish workflow.

---

_Verified: 2026-03-21T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
