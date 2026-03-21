'use server'

import { auth } from '@/auth'
import type { Session } from 'next-auth'
import { db, withRLSContext, notifications, notificationMutePreferences } from '@repo/db'
import { eq, and, desc, count } from 'drizzle-orm'
import { isCritical } from '@/lib/notifications'
import { revalidatePath } from 'next/cache'

function buildUser(session: Session) {
  return { ...session.user, sub: session.user.id! }
}

export async function getUnreadCount(): Promise<number> {
  const session = await auth()
  if (!session?.user) throw new Error('Not authenticated')
  const user = buildUser(session)

  return withRLSContext(user, async (tx) => {
    const result = await tx
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.user_id, user.sub), eq(notifications.read, false)))
    return result[0]?.value ?? 0
  })
}

export async function getRecentNotifications(limit = 10) {
  const session = await auth()
  if (!session?.user) throw new Error('Not authenticated')
  const user = buildUser(session)

  return withRLSContext(user, async (tx) => {
    return tx
      .select()
      .from(notifications)
      .where(eq(notifications.user_id, user.sub))
      .orderBy(desc(notifications.created_at))
      .limit(limit)
  })
}

export async function getNotifications(page = 1, pageSize = 20) {
  const session = await auth()
  if (!session?.user) throw new Error('Not authenticated')
  const user = buildUser(session)

  const offset = (page - 1) * pageSize

  return withRLSContext(user, async (tx) => {
    const [items, totalResult] = await Promise.all([
      tx
        .select()
        .from(notifications)
        .where(eq(notifications.user_id, user.sub))
        .orderBy(desc(notifications.created_at))
        .limit(pageSize)
        .offset(offset),
      tx
        .select({ value: count() })
        .from(notifications)
        .where(eq(notifications.user_id, user.sub)),
    ])

    return { items, total: totalResult[0]?.value ?? 0 }
  })
}

export async function markNotificationRead(notificationId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Not authenticated')
  const user = buildUser(session)

  await withRLSContext(user, async (tx) => {
    await tx
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, notificationId))
  })

  revalidatePath('/notifications')
}

export async function markAllRead() {
  const session = await auth()
  if (!session?.user) throw new Error('Not authenticated')
  const user = buildUser(session)

  await withRLSContext(user, async (tx) => {
    await tx
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.user_id, user.sub), eq(notifications.read, false)))
  })

  revalidatePath('/notifications')
}

export async function saveMutePreference(notificationType: string, muted: boolean) {
  const session = await auth()
  if (!session?.user) throw new Error('Not authenticated')
  const user = buildUser(session)

  if (isCritical(notificationType)) {
    throw new Error('Critical notification types cannot be muted')
  }

  await withRLSContext(user, async (tx) => {
    await tx
      .insert(notificationMutePreferences)
      .values({
        user_id: user.sub,
        notification_type: notificationType,
        muted,
      })
      .onConflictDoUpdate({
        target: [notificationMutePreferences.user_id, notificationMutePreferences.notification_type],
        set: { muted },
      })
  })

  revalidatePath('/notifications')
}

export async function getMutePreferences() {
  const session = await auth()
  if (!session?.user) throw new Error('Not authenticated')
  const user = buildUser(session)

  return withRLSContext(user, async (tx) => {
    const rows = await tx
      .select({
        notification_type: notificationMutePreferences.notification_type,
        muted: notificationMutePreferences.muted,
      })
      .from(notificationMutePreferences)
      .where(eq(notificationMutePreferences.user_id, user.sub))

    return rows
  })
}
