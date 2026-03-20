'use server'

import { auth } from '@/auth'
import {
  transportProviders,
  transportProviderClients,
  tenants,
  withRLSContext,
} from '@repo/db'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Auth helpers ---

async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    throw new Error('Unauthorized: reco-admin role required')
  }
  const user = session.user
  return {
    ...user,
    sub: user.id!,
  }
}

async function getSessionClaims() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return { ...session.user, sub: session.user.id! }
}

// --- Validation ---

const providerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
    contact_email: z.string().email('Invalid email address').optional().nullable(),
    contact_phone: z.string().optional().nullable(),
    service_regions: z.string().optional().nullable(),
    provider_type: z.enum(['direct', 'consolidation'], {
      required_error: 'Provider type is required',
    }),
    warehouse_address: z.string().optional().nullable(),
    has_platform_access: z
      .union([z.boolean(), z.string()])
      .transform((v) => (typeof v === 'string' ? v === 'true' : v))
      .default(false),
    active: z
      .union([z.boolean(), z.string()])
      .transform((v) => (typeof v === 'string' ? v === 'true' : v))
      .default(true),
    linked_tenant_ids: z
      .array(z.string())
      .min(1, 'At least one client must be linked'),
  })
  .refine(
    (data) => {
      if (data.provider_type === 'consolidation') {
        return !!data.warehouse_address && data.warehouse_address.trim().length > 0
      }
      return true
    },
    {
      message: 'Warehouse address is required for consolidation providers',
      path: ['warehouse_address'],
    }
  )

// --- Read actions ---

export async function getTransportProviders() {
  const claims = await getSessionClaims()

  return withRLSContext(claims, async (tx) => {
    const providers = await tx
      .select({
        id: transportProviders.id,
        name: transportProviders.name,
        provider_type: transportProviders.provider_type,
        service_regions: transportProviders.service_regions,
        has_platform_access: transportProviders.has_platform_access,
        active: transportProviders.active,
        created_at: transportProviders.created_at,
      })
      .from(transportProviders)
      .orderBy(transportProviders.name)

    // Fetch linked tenant counts in a single query
    const clientRows = await tx
      .select({
        transport_provider_id: transportProviderClients.transport_provider_id,
        tenant_id: transportProviderClients.tenant_id,
      })
      .from(transportProviderClients)

    const countMap = new Map<string, number>()
    for (const row of clientRows) {
      countMap.set(row.transport_provider_id, (countMap.get(row.transport_provider_id) ?? 0) + 1)
    }

    return providers.map((p) => ({
      ...p,
      linked_client_count: countMap.get(p.id) ?? 0,
    }))
  })
}

export async function getTransportProvider(id: string) {
  const validatedId = z.string().uuid().parse(id)
  const claims = await getSessionClaims()

  return withRLSContext(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(transportProviders)
      .where(eq(transportProviders.id, validatedId))
      .limit(1)

    const provider = rows[0] ?? null
    if (!provider) return null

    const clientRows = await tx
      .select({ tenant_id: transportProviderClients.tenant_id })
      .from(transportProviderClients)
      .where(eq(transportProviderClients.transport_provider_id, validatedId))

    return {
      ...provider,
      linked_tenant_ids: clientRows.map((r) => r.tenant_id),
    }
  })
}

export async function getAllTenants() {
  const claims = await getSessionClaims()

  return withRLSContext(claims, async (tx) => {
    return tx
      .select({ id: tenants.id, name: tenants.name })
      .from(tenants)
      .orderBy(tenants.name)
  })
}

// --- Write actions ---

export async function createTransportProvider(formData: FormData) {
  const user = await requireRecoAdmin()

  const raw = {
    name: formData.get('name'),
    contact_email: formData.get('contact_email') || null,
    contact_phone: formData.get('contact_phone') || null,
    service_regions: formData.get('service_regions') || null,
    provider_type: formData.get('provider_type'),
    warehouse_address: formData.get('warehouse_address') || null,
    has_platform_access: formData.get('has_platform_access') ?? false,
    active: formData.get('active') ?? true,
    linked_tenant_ids: formData.getAll('linked_tenant_ids'),
  }

  const parsed = providerSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Validation failed' }
  }

  const data = parsed.data

  const inserted = await withRLSContext(user, async (tx) => {
    const rows = await tx
      .insert(transportProviders)
      .values({
        name: data.name,
        contact_email: data.contact_email ?? null,
        contact_phone: data.contact_phone ?? null,
        service_regions: data.service_regions ?? null,
        provider_type: data.provider_type,
        warehouse_address: data.warehouse_address ?? null,
        has_platform_access: data.has_platform_access as boolean,
        active: data.active as boolean,
      })
      .returning({ id: transportProviders.id })

    const providerId = rows[0].id

    if (data.linked_tenant_ids.length > 0) {
      await tx.insert(transportProviderClients).values(
        data.linked_tenant_ids.map((tenantId) => ({
          transport_provider_id: providerId,
          tenant_id: tenantId,
        }))
      )
    }

    return { providerId }
  })

  revalidatePath('/transport/providers')
  return { success: true, providerId: inserted.providerId }
}

export async function updateTransportProvider(providerId: string, formData: FormData) {
  const user = await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(providerId)

  const raw = {
    name: formData.get('name'),
    contact_email: formData.get('contact_email') || null,
    contact_phone: formData.get('contact_phone') || null,
    service_regions: formData.get('service_regions') || null,
    provider_type: formData.get('provider_type'),
    warehouse_address: formData.get('warehouse_address') || null,
    has_platform_access: formData.get('has_platform_access') ?? false,
    active: formData.get('active') ?? true,
    linked_tenant_ids: formData.getAll('linked_tenant_ids'),
  }

  const parsed = providerSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Validation failed' }
  }

  const data = parsed.data

  await withRLSContext(user, async (tx) => {
    await tx
      .update(transportProviders)
      .set({
        name: data.name,
        contact_email: data.contact_email ?? null,
        contact_phone: data.contact_phone ?? null,
        service_regions: data.service_regions ?? null,
        provider_type: data.provider_type,
        warehouse_address: data.warehouse_address ?? null,
        has_platform_access: data.has_platform_access as boolean,
        active: data.active as boolean,
        updated_at: new Date(),
      })
      .where(eq(transportProviders.id, validatedId))

    // Replace linked tenants: delete existing, insert new
    await tx
      .delete(transportProviderClients)
      .where(eq(transportProviderClients.transport_provider_id, validatedId))

    if (data.linked_tenant_ids.length > 0) {
      await tx.insert(transportProviderClients).values(
        data.linked_tenant_ids.map((tenantId) => ({
          transport_provider_id: validatedId,
          tenant_id: tenantId,
        }))
      )
    }
  })

  revalidatePath('/transport/providers')
  revalidatePath(`/transport/providers/${validatedId}`)
  return { success: true }
}
