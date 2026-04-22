import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { requireAuth } from '@/lib/auth-guard'
import { OpsNavBar } from './ops-nav-bar'
import { NotificationBell } from '@/components/notification-bell'
import { getUnreadCount, getRecentNotifications } from '@/lib/notification-actions'
import { SignOutButton } from '@/components/sign-out-button'

export default async function OpsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth(['reco-admin', 'reco', 'transport', 'prison'])
  const session = await auth()

  const [unreadCount, recentNotifications] = await Promise.all([
    getUnreadCount(),
    getRecentNotifications(10),
  ])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="font-heading text-lg font-semibold">
            reco ops
          </Link>
          <div className="flex items-center gap-4">
            <OpsNavBar role={session?.user?.role} />
            <NotificationBell
              userId={session!.user!.id!}
              initialCount={unreadCount}
              initialNotifications={recentNotifications}
            />
            <SignOutButton action={async () => { 'use server'; await signOut({ redirectTo: '/sign-in' }) }} />
          </div>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
