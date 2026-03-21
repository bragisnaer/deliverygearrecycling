'use client'

import { useState, useEffect, useRef } from 'react'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { markNotificationRead, markAllRead } from '@/lib/notification-actions'

type Notification = {
  id: string
  type: string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  read: boolean
  created_at: Date
}

interface NotificationBellProps {
  userId: string
  initialCount: number
  initialNotifications: Notification[]
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

export function NotificationBell({ userId, initialCount, initialNotifications }: NotificationBellProps) {
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(initialCount)
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Supabase Realtime subscription for live badge updates
  useEffect(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) return

    const { createClient } = require('@supabase/supabase-js')
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Notification }) => {
          setUnreadCount((prev) => prev + 1)
          setNotifications((prev) => [payload.new, ...prev])
          toast(payload.new.title)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Click-outside handler
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  async function handleMarkAllRead() {
    await markAllRead()
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.read) {
      await markNotificationRead(notification.id)
      setUnreadCount((prev) => Math.max(0, prev - 1))
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
      )
    }
    const url = getEntityUrl(notification.entity_type, notification.entity_id)
    if (url) {
      router.push(url)
    }
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-border bg-background shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-mono text-[13px] font-semibold text-foreground">
              Notifications
            </span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Mark all read
            </button>
          </div>

          {/* Notification list (first 5) */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 5).length === 0 ? (
              <div className="px-4 py-6 text-center font-mono text-[13px] text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.slice(0, 5).map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50 last:border-b-0"
                >
                  {/* Unread indicator */}
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
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-3">
            <a
              href="/notifications"
              className="block text-center font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              View all notifications
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
