// Server-only utility — imported by Server Actions, not called directly from client
import { db, notifications, notificationMutePreferences, users } from '@repo/db'
import { eq, and } from 'drizzle-orm'
import { isCritical } from '@/lib/notifications'
import { sendEmail } from '@/lib/email'
import type React from 'react'

interface DispatchParams {
  userId: string | null // target user — null for broadcast
  tenantId: string | null // tenant scope — null for platform-level
  type: string // notification type constant
  title: string
  body: string
  entityType: string | null
  entityId: string | null
  email?: {
    // if provided, send email too
    to: string | string[]
    subject: string
    react: React.ReactElement
  }
}

/**
 * Dispatches an in-app notification (with optional email) for any notification event.
 *
 * - Checks mute preferences for non-critical types (skips in-app insert if muted)
 * - Critical types always send both in-app and email regardless of mute preferences
 * - Email sending is non-blocking (wrapped in try/catch)
 * - Uses raw db (not withRLSContext) — notifications are platform-level and dispatch
 *   often runs in contexts where the current user role cannot INSERT notifications
 *   (e.g., prison_role). Matches existing pattern from Phase 5.
 */
export async function dispatchNotification(params: DispatchParams): Promise<void> {
  const { userId, tenantId, type, title, body, entityType, entityId, email } = params

  // 1. Check mute preferences (only for non-critical, only if userId is set)
  let isMuted = false
  if (userId && !isCritical(type)) {
    const prefs = await db
      .select({ muted: notificationMutePreferences.muted })
      .from(notificationMutePreferences)
      .where(
        and(
          eq(notificationMutePreferences.user_id, userId),
          eq(notificationMutePreferences.notification_type, type)
        )
      )
      .limit(1)
    isMuted = prefs[0]?.muted === true
  }

  // 2. Insert in-app notification (skip if muted)
  if (!isMuted) {
    try {
      await db.insert(notifications).values({
        user_id: userId,
        tenant_id: tenantId,
        type,
        title,
        body,
        entity_type: entityType,
        entity_id: entityId,
      })
    } catch (err) {
      console.error('[notification] Insert failed:', err)
    }
  }

  // 3. Send email (always for critical types, skip if muted for non-critical)
  if (email && (isCritical(type) || !isMuted)) {
    try {
      await sendEmail(email)
    } catch (err) {
      console.error('[notification-email] Send failed:', err)
    }
  }
}

/**
 * Returns email addresses of all reco-admin users.
 * Uses raw db (not withRLSContext) — client_role RLS cannot read reco-admin users
 * cross-tenants; raw db runs as service role.
 */
export async function getRecoAdminEmails(): Promise<string[]> {
  const admins = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, 'reco-admin'))
  return admins.map((a) => a.email).filter(Boolean) as string[]
}
