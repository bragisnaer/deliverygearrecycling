'use server'

import { auth } from '@/auth'
import { db, systemSettings, prisonFacilities } from '@repo/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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
