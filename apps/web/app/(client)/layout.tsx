import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { getBrandingForTenant, buildBrandingStyle, getGoogleFontUrls } from '@/lib/branding'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAuth(['client', 'client-global'])

  // Fetch tenant branding — returns null if no record (BRAND-04: reco defaults apply)
  const branding = await getBrandingForTenant(user.tenant_id ?? '')
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
            </nav>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </>
  )
}
