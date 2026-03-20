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
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="h-8" />
          ) : (
            <h1 className="font-heading text-lg font-semibold">Client Portal</h1>
          )}
        </header>
        <main className="p-6">{children}</main>
      </div>
    </>
  )
}
