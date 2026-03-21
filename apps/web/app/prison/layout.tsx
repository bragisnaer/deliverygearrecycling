import { redirect } from 'next/navigation'
import { getMessages } from 'next-intl/server'
import { NextIntlClientProvider } from 'next-intl'
import { auth } from '@/auth'
import { NotificationBell } from '@/components/notification-bell'
import { getUnreadCount, getRecentNotifications } from '@/lib/notification-actions'

export default async function PrisonLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/prison/login')
  }

  if (session.user.role !== 'prison') {
    redirect('/prison/login')
  }

  const [messages, unreadCount, recentNotifications] = await Promise.all([
    getMessages(),
    getUnreadCount(),
    getRecentNotifications(10),
  ])

  return (
    <NextIntlClientProvider locale="da" messages={messages}>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="font-heading text-lg font-semibold">reco</span>
            <span className="font-heading text-base font-medium text-muted-foreground">
              {session.user.facility_id ?? 'Facility'}
            </span>
            <NotificationBell
              userId={session.user.id!}
              initialCount={unreadCount}
              initialNotifications={recentNotifications}
            />
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </NextIntlClientProvider>
  )
}
