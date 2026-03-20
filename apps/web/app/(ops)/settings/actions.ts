'use server'

import { auth, signIn } from '@/auth'
import { db, systemSettings, prisonFacilities, users, tenantBranding, tenants } from '@repo/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { UserRole } from '@repo/types'
import { USER_ROLES } from '@repo/types'
import { checkBrandingContrast } from '@/lib/contrast'

// --- Validation Schemas ---

const generalSettingsSchema = z.object({
  exchange_rate_eur_dkk: z
    .number()
    .min(1, 'Exchange rate must be at least 1')
    .max(999.99, 'Exchange rate must be at most 999.99'),
  warehouse_ageing_threshold_days: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 day')
    .max(365, 'Must be at most 365 days'),
  discrepancy_alert_threshold_pct: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1%')
    .max(100, 'Must be at most 100%'),
})

const facilitySchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, digits and hyphens only'),
  name: z.string().min(1, 'Facility name is required').max(200),
  address: z.string().min(1, 'Address is required').max(500),
  contact_email: z.string().email('Valid email required'),
})

// --- Auth helper ---

async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    throw new Error('Unauthorized: reco-admin role required')
  }
  return session.user
}

// --- General Settings ---

export async function getGeneralSettings() {
  await requireRecoAdmin()
  const [settings] = await db.select().from(systemSettings).limit(1)
  return settings ?? null
}

export async function saveGeneralSettings(data: {
  exchange_rate_eur_dkk: number
  warehouse_ageing_threshold_days: number
  discrepancy_alert_threshold_pct: number
}) {
  const user = await requireRecoAdmin()
  const parsed = generalSettingsSchema.parse(data)

  // Drizzle maps numeric columns to string — convert before insert
  const dbValues = {
    id: 1 as const,
    exchange_rate_eur_dkk: parsed.exchange_rate_eur_dkk.toFixed(4),
    warehouse_ageing_threshold_days: parsed.warehouse_ageing_threshold_days,
    discrepancy_alert_threshold_pct: parsed.discrepancy_alert_threshold_pct,
    updated_by: user.id,
    updated_at: new Date(),
  }

  await db
    .insert(systemSettings)
    .values(dbValues)
    .onConflictDoUpdate({
      target: systemSettings.id,
      set: {
        exchange_rate_eur_dkk: dbValues.exchange_rate_eur_dkk,
        warehouse_ageing_threshold_days: dbValues.warehouse_ageing_threshold_days,
        discrepancy_alert_threshold_pct: dbValues.discrepancy_alert_threshold_pct,
        updated_by: dbValues.updated_by,
        updated_at: dbValues.updated_at,
      },
    })

  revalidatePath('/settings')
  return { success: true }
}

// --- Prison Facilities ---

export async function getFacilities() {
  await requireRecoAdmin()
  return db.select().from(prisonFacilities).orderBy(prisonFacilities.name)
}

export async function createFacility(data: {
  slug: string
  name: string
  address: string
  contact_email: string
}) {
  await requireRecoAdmin()
  const parsed = facilitySchema.parse(data)

  const [facility] = await db.insert(prisonFacilities).values(parsed).returning()

  revalidatePath('/settings')
  return facility
}

export async function updateFacility(
  id: string,
  data: Partial<{
    slug: string
    name: string
    address: string
    contact_email: string
  }>
) {
  await requireRecoAdmin()

  // Validate only provided fields
  const partial: Record<string, unknown> = {}
  if (data.slug !== undefined)
    partial.slug = z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, digits and hyphens only')
      .parse(data.slug)
  if (data.name !== undefined) partial.name = z.string().min(1).max(200).parse(data.name)
  if (data.address !== undefined)
    partial.address = z.string().min(1).max(500).parse(data.address)
  if (data.contact_email !== undefined)
    partial.contact_email = z.string().email().parse(data.contact_email)

  await db
    .update(prisonFacilities)
    .set({ ...partial, updated_at: new Date() })
    .where(eq(prisonFacilities.id, id))

  revalidatePath('/settings')
  return { success: true }
}

export async function archiveFacility(id: string) {
  await requireRecoAdmin()

  await db
    .update(prisonFacilities)
    .set({ active: false, updated_at: new Date() })
    .where(eq(prisonFacilities.id, id))

  revalidatePath('/settings')
  return { success: true }
}

export async function restoreFacility(id: string) {
  await requireRecoAdmin()

  await db
    .update(prisonFacilities)
    .set({ active: true, updated_at: new Date() })
    .where(eq(prisonFacilities.id, id))

  revalidatePath('/settings')
  return { success: true }
}

// --- User Management ---

export async function getUsers() {
  await requireRecoAdmin()
  return db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      tenant_id: users.tenant_id,
      active: users.active,
      created_at: users.created_at,
    })
    .from(users)
    .orderBy(users.email)
}

const inviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(USER_ROLES as unknown as [string, ...string[]]),
  tenant_id: z.string().nullable(),
})

export async function inviteUser(data: {
  email: string
  role: UserRole
  tenant_id: string | null
}) {
  await requireRecoAdmin()
  const parsed = inviteUserSchema.parse(data)

  await db.insert(users).values({
    email: parsed.email,
    role: parsed.role as UserRole,
    tenant_id: parsed.tenant_id,
    active: true,
  })

  // Trigger magic link invite email — may throw a redirect error even with redirect:false
  try {
    await signIn('resend', { email: parsed.email, redirect: false, callbackUrl: '/dashboard' })
  } catch {
    // Swallow redirect errors thrown by next-auth with redirect:false
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function deactivateUser(userId: string) {
  await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(userId)

  await db
    .update(users)
    .set({ active: false, updated_at: new Date() })
    .where(eq(users.id, validatedId))

  revalidatePath('/settings')
  return { success: true }
}

export async function reactivateUser(userId: string) {
  await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(userId)

  await db
    .update(users)
    .set({ active: true, updated_at: new Date() })
    .where(eq(users.id, validatedId))

  revalidatePath('/settings')
  return { success: true }
}

// --- Branding ---

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid 6-digit hex colour')
  .nullable()
  .optional()

const fontSchema = z
  .enum(['system-ui', 'Inter', 'DM Sans', 'Lato', 'Nunito', 'Roboto', 'Source Sans 3'] as const)
  .nullable()
  .optional()

const brandingSchema = z.object({
  tenant_id: z.string().min(1, 'Tenant is required'),
  logo_url: z.string().url('Must be a valid URL').nullable().optional(),
  favicon_url: z.string().url('Must be a valid URL').nullable().optional(),
  primary_color: hexColorSchema,
  secondary_color: hexColorSchema,
  background_color: hexColorSchema,
  foreground_color: hexColorSchema,
  accent_color: hexColorSchema,
  heading_font: fontSchema,
  body_font: fontSchema,
})

export async function getTenants() {
  await requireRecoAdmin()
  return db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.active, true))
    .orderBy(tenants.name)
}

export async function getBranding(tenantId: string) {
  await requireRecoAdmin()
  if (!tenantId) return null
  const [branding] = await db
    .select()
    .from(tenantBranding)
    .where(eq(tenantBranding.tenant_id, tenantId))
    .limit(1)
  return branding ?? null
}

export async function saveBranding(data: {
  tenant_id: string
  logo_url?: string | null
  favicon_url?: string | null
  primary_color?: string | null
  secondary_color?: string | null
  background_color?: string | null
  foreground_color?: string | null
  accent_color?: string | null
  heading_font?: string | null
  body_font?: string | null
}) {
  await requireRecoAdmin()
  const parsed = brandingSchema.parse(data)

  // BRAND-05: WCAG AA contrast validation before save
  // Use reco defaults as fallback for unset colours
  const bg = parsed.background_color ?? '#FAF9F4'
  const fg = parsed.foreground_color ?? '#000000'
  const primary = parsed.primary_color ?? '#ED1C24'

  const contrastError = checkBrandingContrast([
    { fg, bg, label: 'text on background' },
    { fg: primary, bg, label: 'primary on background' },
  ])

  if (contrastError) {
    return { success: false, error: contrastError }
  }

  // Upsert branding record (unique on tenant_id)
  const values = {
    tenant_id: parsed.tenant_id,
    logo_url: parsed.logo_url ?? null,
    favicon_url: parsed.favicon_url ?? null,
    primary_color: parsed.primary_color ?? null,
    secondary_color: parsed.secondary_color ?? null,
    background_color: parsed.background_color ?? null,
    foreground_color: parsed.foreground_color ?? null,
    accent_color: parsed.accent_color ?? null,
    heading_font: parsed.heading_font ?? null,
    body_font: parsed.body_font ?? null,
    updated_at: new Date(),
  }

  await db
    .insert(tenantBranding)
    .values(values)
    .onConflictDoUpdate({
      target: tenantBranding.tenant_id,
      set: {
        logo_url: values.logo_url,
        favicon_url: values.favicon_url,
        primary_color: values.primary_color,
        secondary_color: values.secondary_color,
        background_color: values.background_color,
        foreground_color: values.foreground_color,
        accent_color: values.accent_color,
        heading_font: values.heading_font,
        body_font: values.body_font,
        updated_at: values.updated_at,
      },
    })

  revalidatePath('/settings')
  return { success: true }
}
