import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getNotifications, getMutePreferences } from '@/lib/notification-actions'
import { NotificationList } from '@/components/notification-list'

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await auth()
  if (!session?.user) {
    redirect('/sign-in')
  }

  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  const [{ items, total }, prefs] = await Promise.all([
    getNotifications(page, 20),
    getMutePreferences(),
  ])

  return (
    <div className="mx-auto max-w-2xl">
      <NotificationList
        notifications={items}
        mutePreferences={prefs}
        total={total}
        page={page}
      />
    </div>
  )
}
