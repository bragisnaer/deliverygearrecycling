import { db, tenantBranding } from '@repo/db'
import { eq } from 'drizzle-orm'
import type React from 'react'

export const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

export const ALLOWED_FONTS = [
  'system-ui',
  'Inter',
  'DM Sans',
  'Lato',
  'Nunito',
  'Roboto',
  'Source Sans 3',
] as const

export type AllowedFont = (typeof ALLOWED_FONTS)[number]

/**
 * Fetch branding for a tenant. Returns null if no record exists.
 * Uses raw db client (no RLS context) because branding is non-sensitive
 * and needed on sign-in pages before auth context is available.
 */
export async function getBrandingForTenant(tenantId: string) {
  if (!tenantId) return null
  const [branding] = await db
    .select()
    .from(tenantBranding)
    .where(eq(tenantBranding.tenant_id, tenantId))
    .limit(1)
  return branding ?? null
}

/**
 * Map of branding DB columns to CSS variable names.
 * Only colour fields that have a matching :root variable in globals.css.
 */
const COLOR_MAP: Record<string, string> = {
  primary_color: '--primary',
  secondary_color: '--secondary',
  background_color: '--background',
  foreground_color: '--foreground',
  accent_color: '--accent',
}

/**
 * Build a React CSSProperties object from a branding record.
 * Returns undefined if no overrides needed (null branding or all fields null).
 * HEX values validated before injection. Font names checked against allowlist.
 */
export function buildBrandingStyle(
  branding: Awaited<ReturnType<typeof getBrandingForTenant>>
): React.CSSProperties | undefined {
  if (!branding) return undefined

  const vars: Record<string, string> = {}

  // Inject validated colour overrides
  for (const [dbCol, cssVar] of Object.entries(COLOR_MAP)) {
    const value = (branding as Record<string, unknown>)[dbCol]
    if (typeof value === 'string' && HEX_REGEX.test(value)) {
      vars[cssVar] = value
    }
  }

  // Inject validated font overrides
  if (branding.heading_font && ALLOWED_FONTS.includes(branding.heading_font as AllowedFont)) {
    vars['--font-heading'] = `'${branding.heading_font}', sans-serif`
  }
  if (branding.body_font && ALLOWED_FONTS.includes(branding.body_font as AllowedFont)) {
    vars['--font-sans'] = `'${branding.body_font}', sans-serif`
  }

  return Object.keys(vars).length > 0 ? (vars as React.CSSProperties) : undefined
}

/**
 * Get Google Fonts <link> URLs for non-system fonts used in branding.
 * Returns empty array if no Google Fonts needed.
 */
export function getGoogleFontUrls(branding: Awaited<ReturnType<typeof getBrandingForTenant>>): string[] {
  if (!branding) return []
  const fonts = new Set<string>()

  for (const fontField of [branding.heading_font, branding.body_font]) {
    if (fontField && fontField !== 'system-ui' && ALLOWED_FONTS.includes(fontField as AllowedFont)) {
      fonts.add(fontField)
    }
  }

  return Array.from(fonts).map(
    (font) => `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`
  )
}
