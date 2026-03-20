import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { TenantContext } from '@repo/types'
import type { Session } from 'next-auth'

const RESERVED_SUBDOMAINS = new Set(['ops', 'www', 'api'])

export function getTenantFromHost(
  host: string,
  domainMode: string = process.env.NEXT_PUBLIC_DOMAIN_MODE ?? 'custom'
): TenantContext {
  const hostname = host.split(':')[0] // strip port

  // Azure default domain — no subdomain structure available
  if (domainMode === 'azure-default' || hostname.endsWith('.azurecontainerapps.io')) {
    return { context: 'ops', tenantSlug: null }
  }

  const parts = hostname.split('.')

  const subdomain = parts[0]
  const tld = parts[parts.length - 1]

  // Dev subdomain on localhost (e.g. ops.localhost, wolt.localhost) — 2 parts only
  if (tld === 'localhost') {
    if (parts.length === 1 || subdomain === 'localhost') {
      // bare localhost — ops default
      return { context: 'ops', tenantSlug: null }
    }
    if (subdomain === 'ops') return { context: 'ops', tenantSlug: null }
    if (subdomain === 'www') return { context: 'public', tenantSlug: null }
    return { context: 'client', tenantSlug: subdomain }
  }

  // localhost or apex domain (courierrecycling.com = 2 parts)
  if (parts.length <= 2) {
    // In dev, bare localhost or 127.0.0.1 defaults to ops
    if (hostname === 'localhost' || hostname.startsWith('127.0.0.1')) {
      return { context: 'ops', tenantSlug: null }
    }
    return { context: 'public', tenantSlug: null }
  }

  if (subdomain === 'ops') return { context: 'ops', tenantSlug: null }
  if (subdomain === 'www') return { context: 'public', tenantSlug: null }

  // Any other subdomain = client tenant
  return { context: 'client', tenantSlug: subdomain }
}

// Role-to-destination mapping (per CONTEXT.md locked decision)
const ROLE_DESTINATIONS: Record<string, string> = {
  'reco-admin': '/dashboard',
  'reco': '/dashboard',
  'client': '/overview',
  'client-global': '/overview',
  'transport': '/dashboard',
  'prison': '/prison',
}

// Auth-wrapped proxy — session available via request.auth
export const proxy = auth(function middleware(request) {
  const host = request.headers.get('host') ?? 'localhost'
  const { context, tenantSlug } = getTenantFromHost(host)
  const session = (request as any).auth as Session | null
  const { pathname } = request.nextUrl

  // --- Wrong-portal redirect (server-enforced, per CONTEXT.md) ---
  if (session?.user) {
    const role = session.user.role as string

    // Client/client-global visiting ops portal → redirect to their tenant subdomain
    if (context === 'ops' && (role === 'client' || role === 'client-global')) {
      const tenantId = (session.user as any).tenant_id
      if (tenantId) {
        const url = request.nextUrl.clone()
        // Replace ops. with tenantId.
        const currentHost = url.hostname
        if (currentHost.startsWith('ops.')) {
          url.hostname = currentHost.replace(/^ops\./, `${tenantId}.`)
        } else {
          // localhost fallback
          url.hostname = `${tenantId}.localhost`
        }
        url.pathname = '/overview'
        return NextResponse.redirect(url)
      }
    }

    // reco/reco-admin/transport visiting client subdomain → redirect to ops
    if (context === 'client' && ['reco-admin', 'reco', 'transport'].includes(role)) {
      const url = request.nextUrl.clone()
      const currentHost = url.hostname
      // Replace tenant slug with ops
      const parts = currentHost.split('.')
      if (parts.length > 1) {
        parts[0] = 'ops'
        url.hostname = parts.join('.')
      } else {
        url.hostname = 'ops.localhost'
      }
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Post-login redirect: if user lands on root "/" after sign-in, redirect to role destination
    if (pathname === '/') {
      const destination = ROLE_DESTINATIONS[role] ?? '/dashboard'
      const url = request.nextUrl.clone()
      url.pathname = destination
      return NextResponse.redirect(url)
    }
  }

  // --- Standard header injection (unchanged) ---
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-context', context)
  requestHeaders.set('x-tenant-id', tenantSlug ?? '')

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
})

export const config = {
  matcher: [
    // Exclude static files, _next internals, favicons, sitemaps, and Auth.js callback routes
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/auth).*)',
  ],
}
