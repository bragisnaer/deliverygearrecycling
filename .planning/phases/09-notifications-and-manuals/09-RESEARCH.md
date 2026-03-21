# Phase 9: Notifications and Manuals - Research

**Researched:** 2026-03-21
**Domain:** In-app notification centre, email templates, mute preferences, markdown-rendered manuals, admin editor with versioning
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None — all implementation choices are at Claude's discretion.

### Claude's Discretion
All implementation choices are at Claude's discretion — user deferred all decisions to Claude's judgment. Follow established codebase patterns, prior phase conventions, and domain best practices throughout.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTIF-01 | In-app notification centre for all roles; email notifications for key events per PRD §4.8 notification matrix | Existing `notifications` table + RLS patterns; `sendEmail` + react-email templates already established |
| NOTIF-02 | Critical event emails (discrepancy >15%, uninvoiced >14 days, defective batch match, prison facility inactive >14 days) cannot be muted by users | `notification_mute_preferences` table with `is_critical` guard on notification type enum; server-side enforcement |
| NOTIF-03 | Users can mute non-critical in-app notifications per event type | `notification_mute_preferences` table; UI toggle per type in notification centre settings |
| NOTIF-04 | Emails sent via Resend; transactional email templates built with React Email | Resend 6.9.4 + @react-email/components 1.0.10 already installed and in use |
| MANUAL-01 | Client Office Manual at `[client].courierrecycling.com` covering packing guide, gear types, booking walkthrough, FAQs, best practices with photos | New route `/manual` under `(client)` route group; markdown rendered with react-markdown |
| MANUAL-02 | Prison Operations Manual at `ops.courierrecycling.com/prison` covering intake flow, counting guide, QC checklists, processing workflow | New route `/manual` under `(prison)` route; same markdown renderer, separate DB content |
| MANUAL-03 | Markdown-rendered with image and embedded PDF support; reco-admin can edit content; edits versioned with audit trail | `manual_pages` + `manual_page_versions` tables; existing audit_log trigger covers version history |
| MANUAL-04 | Role-appropriate manual version served based on user role and domain | `context` enum column (`client` / `prison`) on `manual_pages`; RLS + layout guard selects correct context |
</phase_requirements>

---

## Summary

Phase 9 builds two distinct features: a notification system (in-app centre + email) and a dual-context manual system (client and prison). Both features have significant infrastructure already in place from prior phases and require careful extension rather than greenfield building.

**Notifications:** The `notifications` table exists and is already used by Phases 4 and 5. The email stack (Resend + @react-email/components) is installed and working. This phase needs: (1) an in-app notification centre UI in the portal layouts, (2) Supabase Realtime subscription for live badge updates, (3) email templates for the remaining seven events from the PRD notification matrix, (4) a `notification_mute_preferences` table with server-side enforcement of unmutable critical types, and (5) per-role RLS policies expanded to cover client and prison roles reading their own notifications.

**Manuals:** The PRD data model names `manual_page` as a core entity. There is no existing manual table or route. This phase needs: a `manual_pages` table (with `context` enum for client vs. prison, `slug`, `title`, `content_md`, `published`) and a `manual_page_versions` table (versioned snapshots for audit trail). Markdown rendering uses `react-markdown` (already available at v10.1.0 in npm; not yet in package.json — needs installing). Image support is native in `react-markdown` with `rehype-raw`. Embedded PDF support is lightweight iframe/object embed (no additional lib needed). The admin editor is a simple `<textarea>` with preview pane — no heavy MDX editor dependency needed for phase 1.

**Primary recommendation:** Extend the existing notification infrastructure incrementally (new RLS policies, new email templates, new UI components), then build the manual system as a straightforward database-backed CMS with react-markdown rendering and a textarea-based admin editor. Both features share the audit_log trigger already installed from Phase 6.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| resend | 6.9.4 | Transactional email sending | Already installed, pattern established in lib/email.ts |
| @react-email/components | 1.0.10 | React-based email templates | Already installed, two templates already built |
| react-markdown | 10.1.0 | Markdown-to-HTML rendering | Ecosystem standard for React; SSR-safe; no client-only restriction |
| rehype-raw | 7.0.0 | Pass-through HTML in markdown (images, iframes) | Required for image tags and PDF embeds in content |
| remark-gfm | 4.0.1 | GitHub Flavoured Markdown (tables, task lists) | Standard for reco-admin-authored content |
| @supabase/supabase-js | 2.99.3 (already in lock) | Supabase Realtime client for live notification badge | Required for `channel().on('postgres_changes')` subscription |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sonner | 1.7.4 (already installed) | Toast notification for real-time in-app alerts | When Realtime event fires — show toast and refresh badge count |
| lucide-react | 0.469.0 (already installed) | Bell icon, check icon for notification UI | Consistent with rest of codebase |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | MDX | MDX requires build-time compilation; DB-stored content must render at runtime — react-markdown wins |
| react-markdown | @uiw/react-md-editor | Editor is overkill for admin; textarea + preview pattern is simpler and already fits codebase style |
| Supabase Realtime | Server-Sent Events / polling | Realtime is built into the Supabase stack already in use; no extra infra |
| iframe PDF embed | @react-pdf/renderer | @react-pdf/renderer renders PDFs, not embeds them; for viewing an uploaded PDF, iframe is correct |

**Installation:**
```bash
pnpm add react-markdown rehype-raw remark-gfm --filter @repo/web
```

**Version verification (npm view output, 2026-03-21):**
- react-markdown: 10.1.0
- rehype-raw: 7.0.0
- remark-gfm: 4.0.1
- @supabase/supabase-js: 2.99.3 (already in lock file via @supabase/storage-js)

---

## Architecture Patterns

### Recommended Project Structure

```
apps/web/
├── app/
│   ├── (ops)/
│   │   ├── notifications/
│   │   │   └── page.tsx               # Full notification list (reco-admin)
│   │   ├── manual-editor/
│   │   │   ├── page.tsx               # Manual editor index (list pages)
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx           # Edit specific manual page
│   │   │   └── actions.ts             # saveManualPage, publishManualPage
│   │   ├── ops-nav-bar.tsx            # ADD: NotificationBell component
│   │   └── layout.tsx                 # ADD: bell icon slot in header
│   ├── (client)/
│   │   ├── manual/
│   │   │   ├── page.tsx               # Manual index / section nav
│   │   │   └── [slug]/
│   │   │       └── page.tsx           # Rendered manual page
│   │   └── layout.tsx                 # ADD: notification bell + Manual nav link
│   └── prison/
│       └── manual/
│           ├── page.tsx               # Prison manual index
│           └── [slug]/
│               └── page.tsx           # Rendered prison manual page
├── emails/
│   ├── pickup-admin-alert.tsx         # EXISTS
│   ├── pickup-confirmation.tsx        # EXISTS
│   ├── discrepancy-alert.tsx          # NEW
│   ├── uninvoiced-alert.tsx           # NEW
│   ├── defective-batch-alert.tsx      # NEW
│   ├── warehouse-ageing-alert.tsx     # NEW
│   ├── outbound-dispatch-email.tsx    # NEW
│   └── facility-inactive-alert.tsx    # NEW
├── components/
│   ├── notification-bell.tsx          # Bell icon + unread badge + dropdown
│   └── notification-list.tsx          # Full paginated list
└── lib/
    └── notifications.ts               # createNotification(), markRead(), getUnreadCount()
```

```
packages/db/src/schema/
├── notifications.ts       # EXISTS — needs expanded RLS for client/prison roles
├── manual-pages.ts        # NEW — manual_pages + manual_page_versions tables
└── index.ts               # ADD exports
```

### Pattern 1: In-App Notification Centre

**What:** Bell icon in every portal header with unread count badge; clicking opens a dropdown with recent notifications; a "View all" link goes to a full page. Marking read uses a Server Action. Live badge refresh uses Supabase Realtime.

**When to use:** All portal layouts — ops, client, and prison headers.

**Shape of notification type enum (extends existing usage):**

```typescript
// lib/notifications.ts
export const CRITICAL_NOTIFICATION_TYPES = [
  'discrepancy_detected',        // INTAKE-06 — discrepancy >15%
  'uninvoiced_delivery',         // FIN-04 — uninvoiced >14 days
  'defective_batch_match',       // INTAKE-07 — quarantine flag
  'facility_inactive',           // no intake >14 days
] as const

export const NON_CRITICAL_NOTIFICATION_TYPES = [
  'pickup_submitted',
  'pickup_confirmed',
  'transport_booked',
  'pickup_collected',
  'pallets_received',
  'warehouse_ageing',
  'outbound_dispatched',
  'delivery_completed',
  'unexpected_intake',
  'processing_submitted',
] as const

export type NotificationType =
  | (typeof CRITICAL_NOTIFICATION_TYPES)[number]
  | (typeof NON_CRITICAL_NOTIFICATION_TYPES)[number]

export function isCritical(type: string): boolean {
  return (CRITICAL_NOTIFICATION_TYPES as readonly string[]).includes(type)
}
```

### Pattern 2: Supabase Realtime Subscription for Live Badge

**What:** Client component subscribes to INSERT events on the `notifications` table filtered by `user_id = current user`. On event, update local unread count state and show a Sonner toast.

**Key constraint:** The Supabase Realtime client requires `@supabase/supabase-js` with an anon/public key — it does NOT go through the RLS server context. Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. This is the standard Supabase pattern for Realtime.

```typescript
// components/notification-bell.tsx — 'use client'
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function NotificationBell({ userId, initialCount }: { userId: string; initialCount: number }) {
  const [unreadCount, setUnreadCount] = useState(initialCount)

  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setUnreadCount((c) => c + 1)
          toast(payload.new.title as string)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ... render bell + badge
}
```

**Note:** Supabase Realtime requires enabling "Realtime" on the `notifications` table in Supabase dashboard (or via migration: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`). This is a one-line migration task.

### Pattern 3: Mute Preferences with Critical Guard

**What:** A `notification_mute_preferences` table stores per-user, per-event-type mute preferences. Before showing a mute toggle in the UI, check `isCritical(type)`. Before inserting a muted notification (in-app), check the user's mute preferences — but always send email for critical types regardless of any preference.

**Schema:**
```sql
CREATE TABLE notification_mute_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  muted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_type),
  -- Enforce: critical types cannot be muted
  CHECK (notification_type NOT IN (
    'discrepancy_detected', 'uninvoiced_delivery',
    'defective_batch_match', 'facility_inactive'
  ))
);
```

**Server-side enforcement:** In `createNotification()`, before inserting an in-app notification, check if the target user has a mute preference for this type. If muted AND not critical: skip in-app insert (still send email for critical events). This ensures the mute is enforced even if UI is bypassed.

### Pattern 4: Manual Pages Schema

**What:** Two tables — `manual_pages` (current published content per slug) and `manual_page_versions` (immutable version snapshots on each save). The `context` column (`client` / `prison`) determines which portal sees which page.

**Schema:**
```sql
-- Current published state
CREATE TABLE manual_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context TEXT NOT NULL CHECK (context IN ('client', 'prison')),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content_md TEXT NOT NULL DEFAULT '',
  published BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(context, slug)
);

-- Version history (append-only, covered by existing audit_log trigger on UPDATE)
CREATE TABLE manual_page_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_page_id UUID NOT NULL REFERENCES manual_pages(id),
  content_md TEXT NOT NULL,
  saved_by UUID REFERENCES auth.users(id),
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Version strategy:** On each admin save, the Server Action: (1) inserts a row into `manual_page_versions` with the previous content_md snapshot, then (2) updates `manual_pages` with the new content. The existing `audit_log_trigger()` will capture the UPDATE to `manual_pages` providing the standard audit trail. `manual_page_versions` gives the planner the full content diff history for the manual editor version panel.

### Pattern 5: Markdown Rendering

**What:** `react-markdown` with `remark-gfm` and `rehype-raw` plugins renders stored markdown to HTML on the server (RSC). Images are standard markdown `![alt](url)` syntax pointing to Supabase Storage URLs. PDFs embed as `<iframe src="..." />` via `rehype-raw` pass-through.

```tsx
// components/manual-renderer.tsx — Server Component (no 'use client' needed)
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

export function ManualRenderer({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

**Prose styling:** The Tailwind `@tailwindcss/typography` plugin provides the `prose` class. Check if it's installed — if not, add it. Alternatively, style the markdown container manually to match codebase patterns (the codebase does not currently use `@tailwindcss/typography`). Custom prose styles are the safer path given the existing no-prose-plugin pattern.

### Pattern 6: Manual Admin Editor

**What:** A `<textarea>` for markdown input with a live preview pane alongside it. No heavy editor library. reco-admin navigates to `/manual-editor`, sees a list of pages per context, clicks to edit, edits markdown, saves (creates version), and publishes.

**Anti-Patterns to Avoid**

- **Sending Realtime to Server Components:** Realtime subscriptions are client-only. The bell icon must be a `'use client'` component even if the parent layout is a Server Component. Pass `initialCount` from the server, then hydrate client-side.
- **Using withRLSContext for Realtime:** The Supabase Realtime client uses the anon key with JWT auth — it does NOT use the `withRLSContext` server-side pattern. These are two separate auth paths.
- **Blocking on email in Server Actions:** Email sending must remain wrapped in `try/catch` and non-blocking (established pattern from Phase 4).
- **Storing notification_mute_preferences in localStorage:** Must be in the database — lost on device switch otherwise.
- **Treating manual_page_versions as the audit_log:** `manual_page_versions` stores full content snapshots; the audit_log_trigger captures field-level diffs. Both serve different purposes and are not redundant.
- **Using MDX for DB-stored content:** MDX is compiled at build time; runtime markdown from the DB must use react-markdown.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown rendering | Custom HTML parser | react-markdown + rehype-raw | XSS surface, edge cases in spec |
| Email template rendering | String templates with HTML | @react-email/components | Already installed, handles inline styles, previews |
| Real-time push | Polling loop | Supabase Realtime postgres_changes | Already in stack; sub-100ms latency |
| Mute enforcement | Client-side only | DB constraint + server-side check | Client can be bypassed; critical types must be server-enforced |
| Version history | Manual JSON blob | Dedicated `manual_page_versions` table | Queryable, appendable, consistent with audit pattern |

**Key insight:** The notification table, email lib, and audit infrastructure are all already built. This phase is almost entirely UI and schema extension, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: Supabase Realtime table not in publication

**What goes wrong:** `channel().on('postgres_changes', ...)` subscribes without error but never fires events.
**Why it happens:** By default, only tables explicitly added to `supabase_realtime` publication receive change events.
**How to avoid:** Add a manual migration step: `ALTER PUBLICATION supabase_realtime ADD TABLE notifications;`
**Warning signs:** Realtime channel subscribes (status: 'SUBSCRIBED') but INSERT events never trigger the callback.

### Pitfall 2: RLS blocks Realtime for client/prison roles

**What goes wrong:** Realtime delivers the event but the payload is empty (`{}`) because RLS redacts the row from the anon key session.
**Why it happens:** Supabase Realtime respects RLS. The anon key session must have SELECT access for the row being pushed.
**How to avoid:** Add RLS policies on `notifications` for `client_role` and `prison_role` roles (`user_id::text = current_setting('request.jwt.claim.sub', true)`). The `notifications` table currently only has policies for `reco_admin` and `transport_role`.
**Warning signs:** Event fires, payload.new is `{}` or undefined.

### Pitfall 3: react-markdown is ESM-only in recent versions

**What goes wrong:** `import ReactMarkdown from 'react-markdown'` fails with ERR_REQUIRE_ESM in Next.js.
**Why it happens:** react-markdown v9+ is ESM-only. Next.js 16 (App Router) handles ESM correctly but the `transpilePackages` option may be needed for some configs.
**How to avoid:** Use react-markdown v10 (ESM). Next.js 16.2.0 supports ESM packages natively in App Router — no `transpilePackages` needed. If Vitest tests import react-markdown, mock it in tests.
**Warning signs:** `SyntaxError: Cannot use import statement in a module` at test time.

### Pitfall 4: Mute preference CHECK constraint rejects insert at DB layer

**What goes wrong:** reco-admin tries to call a "mute all" function that includes critical types, hitting the DB CHECK constraint.
**Why it happens:** The CHECK constraint on `notification_mute_preferences` rejects inserts of critical types.
**How to avoid:** The Server Action for saving mute preferences must filter out critical types before the DB insert. The CHECK constraint is defence-in-depth, not the primary guard.
**Warning signs:** Postgres error `new row for relation "notification_mute_preferences" violates check constraint`.

### Pitfall 5: `manual_page_versions` insert races the audit_log trigger

**What goes wrong:** The audit log trigger fires on `manual_pages` UPDATE, but the version snapshot insert happens in the same transaction — version row created before the trigger's audit log entry, confusing the timeline.
**Why it happens:** Ordering within a transaction.
**How to avoid:** Insert the version snapshot BEFORE updating `manual_pages` within the same transaction. The audit log trigger fires at AFTER UPDATE, so the version row will be committed first in the transaction sequence.

### Pitfall 6: `rehype-raw` enables XSS if content is user-generated

**What goes wrong:** An attacker with reco-admin access embeds `<script>` tags in manual content.
**Why it happens:** `rehype-raw` passes raw HTML through, including scripts.
**How to avoid:** Manual content is only editable by reco-admin (trusted role). This is acceptable. However, sanitise the HTML output with `rehype-sanitize` as a `rehypePlugins` entry after `rehype-raw` if the risk profile changes. For now: reco-admin is trusted, no sanitise needed.

### Pitfall 7: Prison role cannot read `manual_pages` without RLS policy

**What goes wrong:** Prison manual page.tsx returns empty even though rows exist.
**Why it happens:** Prison role has no SELECT policy on `manual_pages` — fail-closed default.
**How to avoid:** Add permissive SELECT policy on `manual_pages` for `prison_role` WHERE `context = 'prison'`. Client role gets SELECT WHERE `context = 'client'`. reco-admin gets SELECT on all.

---

## PRD Notification Matrix (Complete)

This is the full notification matrix from PRD §4.8. Phases 4 and 5 implemented some events partially. Phase 9 must close all gaps.

| Event | Recipients | Channel | Type Constant | Critical? | Status |
|-------|-----------|---------|--------------|-----------|--------|
| New pickup submitted | reco-admin | Email + in-app | `pickup_submitted` | No | EXISTS (Phase 4) |
| Pickup confirmed | Client submitter | Email + in-app | `pickup_confirmed` | No | Email template MISSING |
| Transport booked | Transport provider (if access), client | Email + in-app | `transport_booked` | No | In-app EXISTS; email template MISSING |
| Pickup collected | reco-admin, client | In-app only | `pickup_collected` | No | MISSING |
| Pallets at warehouse | reco-admin | In-app only | `pallets_received` | No | MISSING |
| Pallets held >14 days | reco-admin | Email + in-app | `warehouse_ageing` | No | Alert logic EXISTS (Phase 4); email template MISSING |
| Outbound dispatched | reco-admin, prison | Email + in-app | `outbound_dispatched` | No | MISSING |
| Delivery completed | reco-admin, prison | In-app only | `delivery_completed` | No | MISSING |
| Prison intake submitted | reco-admin | In-app only | `prison_intake` | No | MISSING |
| Discrepancy >15% | reco-admin | Email + in-app | `discrepancy_detected` | **YES** | In-app EXISTS (Phase 5); email template MISSING |
| Defective batch match | reco-admin, prison | Email + in-app | `defective_batch_match` | **YES** | In-app EXISTS (Phase 5); email template MISSING |
| Processing report submitted | reco-admin | In-app only | `processing_submitted` | No | MISSING |
| Uninvoiced >14 days | reco-admin | Email + in-app | `uninvoiced_delivery` | **YES** | Alert logic EXISTS (Phase 7); email template MISSING |
| Facility inactive >14 days | reco-admin | Email only | `facility_inactive` | **YES** | MISSING |

**Gap summary:** 5 new email templates needed; 6 new in-app notification inserts needed; 1 email-only (facility_inactive) with scheduled check logic needed.

---

## Code Examples

### Existing notification insert pattern (extend this)

```typescript
// Source: apps/web/app/(client)/pickups/actions.ts — Phase 4 established pattern
await withRLSContext(user, async (tx) => {
  return tx.insert(notifications).values({
    type: 'pickup_submitted',
    title: `New pickup request: ${reference}`,
    body: `${location.name} submitted a pickup request...`,
    entity_type: 'pickup',
    entity_id: pickupId,
  })
})
```

### Existing email send pattern (extend this)

```typescript
// Source: apps/web/lib/email.ts — established pattern
await sendEmail({
  to: admin.email,
  subject: `New Pickup Request — ${reference}`,
  react: PickupAdminAlertEmail({ reference, clientName, ... }),
})
```

### Mark notifications read — new Server Action

```typescript
// apps/web/app/(ops)/notifications/actions.ts
'use server'
import { db, notifications, withRLSContext } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/auth'

export async function markNotificationRead(notificationId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const user = { ...session.user, sub: session.user.id! }
  await withRLSContext(user, async (tx) => {
    return tx
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId))
  })
}

export async function markAllRead() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  const user = { ...session.user, sub: session.user.id! }
  await withRLSContext(user, async (tx) => {
    return tx
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.user_id, user.sub as unknown as string), eq(notifications.read, false)))
  })
}
```

### Manual page save with version snapshot

```typescript
// apps/web/app/(ops)/manual-editor/[id]/actions.ts
'use server'
import { db, manualPages, manualPageVersions, withRLSContext } from '@repo/db'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'

export async function saveManualPage(id: string, contentMd: string) {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') throw new Error('Unauthorized')
  const user = { ...session.user, sub: session.user.id! }

  await withRLSContext(user, async (tx) => {
    // 1. Snapshot current content as a version (before overwriting)
    const current = await tx
      .select({ content_md: manualPages.content_md })
      .from(manualPages)
      .where(eq(manualPages.id, id))
      .limit(1)

    if (current[0]) {
      await tx.insert(manualPageVersions).values({
        manual_page_id: id,
        content_md: current[0].content_md,
        saved_by: user.sub as unknown as string,
      })
    }

    // 2. Update manual_pages — audit_log trigger fires AFTER this UPDATE
    await tx
      .update(manualPages)
      .set({ content_md: contentMd, updated_at: new Date(), updated_by: user.sub as unknown as string })
      .where(eq(manualPages.id, id))
  })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for new notifications | Supabase Realtime postgres_changes | Supabase GA 2023 | Sub-100ms delivery; no polling overhead |
| String HTML email templates | react-email React components | 2023 | Preview server, inline styles, type safety |
| MDX for DB-stored content | react-markdown at runtime | Community consensus | MDX requires build; DB content needs runtime render |
| Separate notification state per page | Centralised bell in layout | App Router layouts | One subscription per session, not per page |

**Deprecated/outdated:**
- Supabase Realtime v1 (`from().on()` syntax): Replaced by `channel().on('postgres_changes', ...)` in supabase-js v2. The v2 syntax is what this project uses.

---

## Open Questions

1. **NEXT_PUBLIC_SUPABASE_ANON_KEY availability**
   - What we know: `@supabase/storage-js` is already installed but no Supabase client-side usage exists in the app yet. The Realtime pattern requires `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars.
   - What's unclear: Whether these are already configured in `.env.local` / Vercel.
   - Recommendation: Wave 0 of plan 09-01 should confirm these env vars exist and add them to the `.env.example` if missing. If not set, Realtime is non-functional. The bell can still work in polling mode (revalidatePath) as fallback.

2. **Facility inactive >14 days check**
   - What we know: PRD §4.8 says reco-admin gets an email when a prison facility has no intake for >14 days. There is no scheduled job mechanism currently in the codebase.
   - What's unclear: Whether to implement this as a cron (Vercel Cron Job) or as a check triggered on page load of the dashboard.
   - Recommendation: Implement as a dashboard page-load check (same pattern as `checkAndCreateAgeingAlerts` from Phase 4 — see STATE.md). A proper Vercel Cron Job is cleaner but adds infrastructure; the dashboard-trigger pattern is consistent with established patterns.

3. **@tailwindcss/typography plugin**
   - What we know: The `prose` CSS class (from `@tailwindcss/typography`) is the standard way to style markdown output. It is not currently installed in the codebase (Tailwind 4 is used).
   - What's unclear: Whether Tailwind 4 has typography support built-in or still requires the plugin.
   - Recommendation: Skip `@tailwindcss/typography` and use a custom `manual-content` CSS class with explicit typography styles in `globals.css`. This follows the codebase pattern of avoiding new plugin dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.1.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter @repo/web test` |
| Full suite command | `pnpm --filter @repo/web test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTIF-01 | `createNotification()` inserts correct type/title/body | unit | `pnpm --filter @repo/web test -- notifications` | ❌ Wave 0 |
| NOTIF-02 | `isCritical()` returns true for all four critical types | unit | `pnpm --filter @repo/web test -- notifications` | ❌ Wave 0 |
| NOTIF-02 | Mute preference action rejects critical type at server | unit | `pnpm --filter @repo/web test -- mute` | ❌ Wave 0 |
| NOTIF-03 | `saveMutePreference()` succeeds for non-critical type | unit | `pnpm --filter @repo/web test -- mute` | ❌ Wave 0 |
| NOTIF-04 | `sendEmail()` called with React element (existing pattern) | manual-only | — | existing pattern tested in Phase 4 |
| MANUAL-01 | `getManualPage('client', slug)` returns published page | unit | `pnpm --filter @repo/web test -- manual` | ❌ Wave 0 |
| MANUAL-03 | `saveManualPage()` inserts version snapshot before update | unit | `pnpm --filter @repo/web test -- manual` | ❌ Wave 0 |
| MANUAL-04 | `getManualPage('prison', slug)` rejected for client context | unit | `pnpm --filter @repo/web test -- manual` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @repo/web test -- notifications manual`
- **Per wave merge:** `pnpm --filter @repo/web test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/app/(ops)/notifications/notifications.test.ts` — covers NOTIF-01, NOTIF-02, NOTIF-03
- [ ] `apps/web/app/(ops)/manual-editor/manual.test.ts` — covers MANUAL-01, MANUAL-03, MANUAL-04
- [ ] `pnpm add react-markdown rehype-raw remark-gfm --filter @repo/web` — install markdown libs

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection — `packages/db/src/schema/notifications.ts` — existing schema, RLS policies
- Codebase inspection — `apps/web/lib/email.ts` — Resend + react-email pattern
- Codebase inspection — `apps/web/app/(client)/pickups/actions.ts` — notification insert pattern
- Codebase inspection — `apps/web/app/prison/actions.ts` — unexpected_intake notification insert
- Codebase inspection — `apps/web/package.json` — confirmed installed versions
- `npm view resend version` → 6.9.4 (already installed, confirmed)
- `npm view @react-email/components version` → 1.0.10 (already installed, confirmed)
- `npm view react-markdown version` → 10.1.0 (not yet installed)
- `npm view @supabase/supabase-js version` → 2.99.3

### Secondary (MEDIUM confidence)

- PRD §4.8 notification matrix — complete event/recipient/channel table
- PRD §4.9 FAQ and manuals — content requirements for both manual contexts
- PRD §5.1 entity relationship overview — confirms `manual_page` as a core entity

### Tertiary (LOW confidence)

- Supabase Realtime postgres_changes API — based on training knowledge of supabase-js v2 `channel().on()` pattern; should be verified against official docs before Plan 09-01 implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core libs already installed and in use (except react-markdown — version confirmed from npm)
- Architecture: HIGH — all patterns derived from existing codebase conventions
- Notification matrix gap analysis: HIGH — derived from reading all Phase 4/5/7 action files against PRD §4.8
- Pitfalls: HIGH — Realtime/RLS interactions are known Supabase patterns; react-markdown ESM is a well-documented issue
- Realtime API syntax: MEDIUM — training knowledge of supabase-js v2; confirm against official docs before coding

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack; react-markdown and supabase-js are not fast-moving)
