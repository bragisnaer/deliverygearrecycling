'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markNotificationRead, markAllRead, saveMutePreference } from '@/lib/notification-actions'
import { isCritical, NON_CRITICAL_NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS } from '@/lib/notifications'
import type { NotificationType } from '@/lib/notifications'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  read: boolean
  created_at: Date
  entity_type: string | null
  entity_id: string | null
}

interface NotificationListProps {
  notifications: Notification[]
  mutePreferences: Array<{ notification_type: string; muted: boolean }>
  total: number
  page: number
}

function getEntityUrl(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null
  const map: Record<string, string> = {
    pickup: `/pickups/${entityId}`,
    transport_booking: `/transport/${entityId}`,
    intake: `/intake/${entityId}`,
    financial: `/financial/${entityId}`,
    outbound_shipment: `/transport/outbound/${entityId}`,
  }
  return map[entityType] ?? null
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function NotificationList({ notifications: initialNotifications, mutePreferences, total, page }: NotificationListProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)

  // Build a map of muted types for quick lookup
  const mutedMap: Record<string, boolean> = {}
  for (const pref of mutePreferences) {
    mutedMap[pref.notification_type] = pref.muted
  }
  const [localMuted, setLocalMuted] = useState<Record<string, boolean>>(mutedMap)

  async function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      await markNotificationRead(notification.id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
    }
    const url = getEntityUrl(notification.entity_type, notification.entity_id)
    if (url) {
      router.push(url)
    }
  }

  async function handleMarkAllRead() {
    await markAllRead()
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function handleMuteToggle(type: string, checked: boolean) {
    // checked = receiving (not muted); unchecked = muted
    const muted = !checked
    setLocalMuted((prev) => ({ ...prev, [type]: muted }))
    await saveMutePreference(type, muted)
  }

  const pageSize = 20
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-6">
      {/* Notification list */}
      <div className="rounded-lg border border-border bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h1 className="font-heading text-xl font-semibold text-foreground">Notifications</h1>
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            Mark all as read
          </button>
        </div>

        {/* Notifications */}
        {notifications.length === 0 ? (
          <div className="px-6 py-10 text-center font-mono text-[13px] text-muted-foreground">
            No notifications
          </div>
        ) : (
          <div>
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => handleNotificationClick(notification)}
                className="flex w-full items-start gap-4 border-b border-border px-6 py-4 text-left transition-colors hover:bg-muted/50 last:border-b-0"
              >
                {/* Unread dot */}
                <span
                  className={[
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    notification.read ? 'bg-transparent' : 'bg-blue-500',
                  ].join(' ')}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      'font-mono text-[13px] leading-snug',
                      notification.read ? 'text-muted-foreground' : 'font-semibold text-foreground',
                    ].join(' ')}
                  >
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="mt-0.5 line-clamp-2 font-mono text-[12px] text-muted-foreground">
                      {notification.body}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {formatRelativeTime(notification.created_at)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <a
              href={page > 1 ? `/notifications?page=${page - 1}` : undefined}
              className={[
                'font-mono text-[13px] transition-colors',
                page <= 1
                  ? 'pointer-events-none text-muted-foreground/40'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              Previous
            </a>
            <span className="font-mono text-[12px] text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <a
              href={page < totalPages ? `/notifications?page=${page + 1}` : undefined}
              className={[
                'font-mono text-[13px] transition-colors',
                page >= totalPages
                  ? 'pointer-events-none text-muted-foreground/40'
                  : 'text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              Next
            </a>
          </div>
        )}
      </div>

      {/* Mute preferences — non-critical types only */}
      <div className="rounded-lg border border-border bg-background">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Notification Preferences
          </h2>
          <p className="mt-1 font-mono text-[12px] text-muted-foreground">
            Toggle which notifications you receive. Critical alerts cannot be disabled.
          </p>
        </div>
        <div className="divide-y divide-border">
          {NON_CRITICAL_NOTIFICATION_TYPES.map((type) => {
            const label = NOTIFICATION_TYPE_LABELS[type as NotificationType]
            const isMuted = localMuted[type] ?? false
            const isReceiving = !isMuted

            return (
              <div key={type} className="flex items-center justify-between px-6 py-3">
                <span className="font-mono text-[13px] text-foreground">{label}</span>
                <label className="relative inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isReceiving}
                    onChange={(e) => handleMuteToggle(type, e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full border border-border bg-muted transition-colors peer-checked:bg-foreground peer-focus:ring-2 peer-focus:ring-ring" />
                  <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform peer-checked:translate-x-4" />
                  <span className="font-mono text-[12px] text-muted-foreground">
                    {isReceiving ? 'On' : 'Off'}
                  </span>
                </label>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
