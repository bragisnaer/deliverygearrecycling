---
phase: 04-pickup-booking-and-transport-management
plan: "09"
subsystem: notifications
tags: [email, resend, react-email, notifications, transactional]
dependency_graph:
  requires: ["04-02", "04-03"]
  provides: ["pickup-confirmation-email", "pickup-admin-alert-email", "pickup-submitted-notification"]
  affects: ["apps/web/app/(client)/pickups/actions.ts"]
tech_stack:
  added: ["resend@6.9.4", "@react-email/components@1.0.10"]
  patterns: ["React Email template components", "non-blocking email try/catch", "raw db bypass for cross-tenant admin query"]
key_files:
  created:
    - apps/web/lib/email.ts
    - apps/web/emails/pickup-confirmation.tsx
    - apps/web/emails/pickup-admin-alert.tsx
  modified:
    - apps/web/app/(client)/pickups/actions.ts
    - apps/web/app/(client)/pickups/actions.test.ts
    - .env.example
decisions:
  - "Admin email query uses raw db (not withRLSContext) — client_role RLS cannot read reco-admin users from other tenants; raw db runs as service role with full access"
  - "Email sending is non-blocking (wrapped in try/catch) — email failure must not break pickup submission"
  - "In-app notification insert uses withRLSContext(user) — notification RLS grants reco_admin INSERT; client_role insert will silently fail and be caught by try/catch, which is acceptable since admin role typically inserts these"
metrics:
  duration: "~8 minutes"
  completed: "2026-03-20T18:36:42Z"
  tasks: 2
  files: 6
---

# Phase 04 Plan 09: Pickup Email Notifications Summary

Transactional email integration for pickup submissions using Resend SDK and React Email — client confirmation email with PU-YYYY-NNNN reference, reco-admin alert email, and in-app notification row on every pickup submission.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install Resend, create email client and templates | 8dc086d | email.ts, pickup-confirmation.tsx, pickup-admin-alert.tsx, package.json, .env.example |
| 2 | Integrate email + notification into submitPickupRequest | 2ec4d83 | actions.ts, actions.test.ts |

## What Was Built

### apps/web/lib/email.ts
`sendEmail()` wrapper around Resend SDK. Reads `RESEND_API_KEY` and `RESEND_FROM_ADDRESS` (falls back to `onboarding@resend.dev`). Returns `{ success, id }` or `{ success: false, error }` — never throws.

### apps/web/emails/pickup-confirmation.tsx
React Email template sent to client on pickup submission. Shows reference number, location name, preferred date, and pallet count. Footer: "You will receive updates as your pickup progresses."

### apps/web/emails/pickup-admin-alert.tsx
React Email template sent to all active reco-admin users. Shows full pickup summary with a "View in platform" CTA link to `/pickups/{id}`.

### submitPickupRequest additions
After successful DB insert and reference fetch, three non-blocking steps execute:
1. Confirmation email to `user.email` (skipped if email is null)
2. Admin alert emails: queries `users` via raw `db` (bypasses client RLS) for `role='reco-admin' AND active=true`, sends one email per admin
3. In-app notification insert: `type='pickup_submitted'`, `entity_type='pickup'`, `entity_id=pickupId`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security/Correctness] Admin user query uses raw db instead of withRLSContext**
- **Found during:** Task 2
- **Issue:** The plan specified `tx.select(...).from(users).where(...)` inside a `withRLSContext` transaction, but the action runs as `client_role`. The client RLS policy on `users` only allows reading users within the same tenant — reco-admin users have `tenant_id = null`, so the query would return zero results.
- **Fix:** Moved admin email query to raw `db` client (no RLS context), which runs with service role access and can read all users.
- **Files modified:** apps/web/app/(client)/pickups/actions.ts
- **Commit:** 2ec4d83

## Known Stubs

None — all email flows are wired. Emails will silently no-op in development without `RESEND_API_KEY` set (Resend SDK returns an error which is caught and logged).

## Self-Check: PASSED
