import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { SignOutButton } from '@/components/sign-out-button'
import { requireAuth } from '@/lib/auth-guard'
import { getBrandingForTenant, buildBrandingStyle, getGoogleFontUrls } from '@/lib/branding'
import { NotificationBell } from '@/components/notification-bell'
import { getUnreadCount, getRecentNotifications } from '@/lib/notification-actions'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAuth(['client', 'client-global'])
  const session = await auth()

  // Fetch tenant branding — returns null if no record (BRAND-04: reco defaults apply)
  const [branding, unreadCount, recentNotifications] = await Promise.all([
    getBrandingForTenant(user.tenant_id ?? ''),
    getUnreadCount(),
    getRecentNotifications(10),
  ])
  const brandingStyle = buildBrandingStyle(branding)
  const fontUrls = getGoogleFontUrls(branding)

  return (
    <>
      {/* Load Google Fonts for non-system tenant fonts */}
      {fontUrls.map((url) => (
        <link key={url} rel="stylesheet" href={url} />
      ))}
      <div className="min-h-screen bg-background" style={brandingStyle}>
        <header className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {branding?.logo_url ? (
                <img src={branding.logo_url} alt="Logo" className="h-8" />
              ) : (
                <span className="font-heading text-lg font-semibold">Client Portal</span>
              )}
            </div>
            <nav className="flex items-center gap-6">
              <Link
                href="/overview"
                className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Overview
              </Link>
              <Link
                href="/pickups"
                className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Pickups
              </Link>
              <Link
                href="/manual"
                className="font-mono text-[13px] text-muted-foreground transition-colors hover:text-foreground"
              >
                Manual
              </Link>
              <NotificationBell
                userId={session!.user!.id!}
                initialCount={unreadCount}
                initialNotifications={recentNotifications}
              />
              <SignOutButton action={async () => { 'use server'; await signOut({ redirectTo: '/sign-in' }) }} />
            </nav>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </>
  )
}
