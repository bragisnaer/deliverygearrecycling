import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { TenantContext } from '@repo/types'

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

export function proxy(request: NextRequest) {
  const host = request.headers.get('host') ?? 'localhost'
  const { context, tenantSlug } = getTenantFromHost(host)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-context', context)
  requestHeaders.set('x-tenant-id', tenantSlug ?? '')

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

export const config = {
  matcher: [
    // Exclude static files, _next internals, favicons, sitemaps
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
}
