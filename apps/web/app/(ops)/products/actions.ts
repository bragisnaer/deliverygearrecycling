'use server'

import { auth } from '@/auth'
import { db, products, productMaterials, productPricing, materialLibrary, withRLSContext } from '@repo/db'
import { eq, and, ne, isNull } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getProductsBucket, getProductPhotoPath, getMaterialPhotoPath } from '@/lib/storage'

// --- Auth helpers ---

async function requireRecoAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin') {
    throw new Error('Unauthorized: reco-admin role required')
  }
  const user = session.user
  return {
    ...user,
    // JWTClaims requires sub — next-auth stores the user id as session.user.id (= token.sub)
    sub: user.id!,
  }
}

async function getSessionClaims() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return { ...session.user, sub: session.user.id! }
}

// --- Validation ---

const productSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  product_code: z
    .string()
    .min(1, 'Product code is required')
    .max(50, 'Product code must be at most 50 characters'),
  product_group: z.string().max(200).optional().nullable(),
  processing_stream: z.enum(['recycling', 'reuse'], {
    required_error: 'Processing stream is required',
  }),
  description: z.string().optional().nullable(),
  weight_grams: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v === '' || v == null ? null : v)),
  active: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .optional()
    .default(true),
})

// --- Server Actions ---

export async function getProducts() {
  const claims = await getSessionClaims()

  return withRLSContext(claims, async (tx) => {
    return tx
      .select({
        id: products.id,
        name: products.name,
        product_code: products.product_code,
        product_group: products.product_group,
        processing_stream: products.processing_stream,
        weight_grams: products.weight_grams,
        active: products.active,
        created_at: products.created_at,
      })
      .from(products)
      .orderBy(products.name)
  })
}

export async function getProduct(id: string) {
  const validatedId = z.string().uuid().parse(id)
  const claims = await getSessionClaims()

  const result = await withRLSContext(claims, async (tx) => {
    const rows = await tx
      .select()
      .from(products)
      .where(eq(products.id, validatedId))
      .limit(1)
    return rows[0] ?? null
  })

  if (!result) return null

  // Fetch product photos from storage
  const tenantId = claims.tenant_id ?? ''
  const photoPrefix = `${tenantId}/products/${validatedId}/photos/`
  const bucket = getProductsBucket()

  let photos: Array<{ path: string; url: string }> = []
  try {
    const { data: files } = await bucket.list(photoPrefix)
    if (files && files.length > 0) {
      const signedUrls = await Promise.all(
        files.map(async (file) => {
          const filePath = `${photoPrefix}${file.name}`
          const { data } = await bucket.createSignedUrl(filePath, 3600)
          return { path: filePath, url: data?.signedUrl ?? '' }
        })
      )
      photos = signedUrls.filter((p) => p.url !== '')
    }
  } catch {
    // Storage may be unavailable in dev — return product without photos
    photos = []
  }

  return { ...result, photos }
}

export async function createProduct(formData: FormData) {
  const user = await requireRecoAdmin()

  const raw = {
    name: formData.get('name'),
    product_code: formData.get('product_code'),
    product_group: formData.get('product_group') || null,
    processing_stream: formData.get('processing_stream'),
    description: formData.get('description') || null,
    weight_grams: formData.get('weight_grams') || null,
    active: formData.get('active') ?? true,
  }

  const parsed = productSchema.parse(raw)

  const tenantId = user.tenant_id
  if (!tenantId) throw new Error('User has no tenant_id')

  // Check product_code uniqueness within tenant (RLS policy scopes to tenant automatically)
  const existing = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.product_code, parsed.product_code))
      .limit(1)
  })

  if (existing.length > 0) {
    return { error: 'Product code already exists for this tenant' }
  }

  const inserted = await withRLSContext(user, async (tx) => {
    return tx
      .insert(products)
      .values({
        tenant_id: tenantId,
        name: parsed.name,
        product_code: parsed.product_code,
        product_group: parsed.product_group ?? null,
        processing_stream: parsed.processing_stream,
        description: parsed.description ?? null,
        weight_grams: parsed.weight_grams ?? null,
        active: parsed.active as boolean,
      })
      .returning({ id: products.id })
  })

  revalidatePath('/products')
  return { success: true, productId: inserted[0].id }
}

export async function updateProduct(id: string, formData: FormData) {
  const user = await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(id)

  const raw = {
    name: formData.get('name'),
    product_code: formData.get('product_code'),
    product_group: formData.get('product_group') || null,
    processing_stream: formData.get('processing_stream'),
    description: formData.get('description') || null,
    weight_grams: formData.get('weight_grams') || null,
    active: formData.get('active') ?? true,
  }

  const parsed = productSchema.parse(raw)

  // Check product_code uniqueness excluding current product
  const existing = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.product_code, parsed.product_code), ne(products.id, validatedId)))
      .limit(1)
  })

  if (existing.length > 0) {
    return { error: 'Product code already exists for this tenant' }
  }

  await withRLSContext(user, async (tx) => {
    return tx
      .update(products)
      .set({
        name: parsed.name,
        product_code: parsed.product_code,
        product_group: parsed.product_group ?? null,
        processing_stream: parsed.processing_stream,
        description: parsed.description ?? null,
        weight_grams: parsed.weight_grams ?? null,
        active: parsed.active as boolean,
        updated_at: new Date(),
      })
      .where(eq(products.id, validatedId))
  })

  revalidatePath(`/products/${validatedId}`)
  return { success: true }
}

export async function uploadProductPhoto(productId: string, formData: FormData) {
  const user = await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(productId)

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }

  // Validate file size: <= 5MB
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'File size must be 5MB or less' }
  }

  // Validate image type
  if (!file.type.startsWith('image/')) {
    return { error: 'File must be an image' }
  }

  const tenantId = user.tenant_id ?? ''
  const photoPrefix = `${tenantId}/products/${validatedId}/photos/`
  const bucket = getProductsBucket()

  // Check existing photo count
  const { data: existingFiles } = await bucket.list(photoPrefix)
  if (existingFiles && existingFiles.length >= 5) {
    return { error: 'Maximum 5 photos allowed per product' }
  }

  const filename = `${Date.now()}-${file.name}`
  const filePath = getProductPhotoPath(tenantId, validatedId, filename)

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await bucket.upload(filePath, arrayBuffer, {
    contentType: file.type,
  })

  if (error) {
    return { error: `Upload failed: ${error.message}` }
  }

  revalidatePath(`/products/${validatedId}`)
  return { success: true }
}

export async function deleteProductPhoto(productId: string, filePath: string) {
  const user = await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(productId)

  const tenantId = user.tenant_id ?? ''
  const expectedPrefix = `${tenantId}/products/${validatedId}/photos/`

  // Validate filePath starts with expected tenant prefix
  if (!filePath.startsWith(expectedPrefix)) {
    return { error: 'Invalid file path' }
  }

  const bucket = getProductsBucket()
  const { error } = await bucket.remove([filePath])

  if (error) {
    return { error: `Delete failed: ${error.message}` }
  }

  revalidatePath(`/products/${validatedId}`)
  return { success: true }
}

// --- Material Library ---

export async function getMaterials() {
  const claims = await getSessionClaims()

  return withRLSContext(claims, async (tx) => {
    const rows = await tx
      .select({ id: materialLibrary.id, name: materialLibrary.name })
      .from(materialLibrary)
      .orderBy(materialLibrary.name)
    return { materials: rows }
  })
}

export async function createMaterial(name: string) {
  const user = await requireRecoAdmin()
  const validatedName = z.string().min(1).max(100).trim().parse(name)

  return withRLSContext(user, async (tx) => {
    // Insert, ignoring conflicts on the unique name column
    await tx
      .insert(materialLibrary)
      .values({ name: validatedName })
      .onConflictDoNothing()

    // Select the row (whether newly inserted or existing) by name
    const [existing] = await tx
      .select({ id: materialLibrary.id })
      .from(materialLibrary)
      .where(eq(materialLibrary.name, validatedName))
      .limit(1)

    if (!existing) throw new Error('Failed to create or find material')
    return { success: true, materialId: existing.id }
  })
}

// --- Material Composition ---

export async function getCurrentComposition(productId: string) {
  const validatedId = z.string().uuid().parse(productId)
  const claims = await getSessionClaims()

  const rows = await withRLSContext(claims, async (tx) => {
    return tx
      .select({
        id: productMaterials.id,
        material_library_id: productMaterials.material_library_id,
        material_name: materialLibrary.name,
        weight_grams: productMaterials.weight_grams,
        recycling_cost_per_kg_eur: productMaterials.recycling_cost_per_kg_eur,
        recycling_cost_per_kg_dkk: productMaterials.recycling_cost_per_kg_dkk,
        recycling_outcome: productMaterials.recycling_outcome,
        disassembly_photo_paths: productMaterials.disassembly_photo_paths,
      })
      .from(productMaterials)
      .innerJoin(materialLibrary, eq(productMaterials.material_library_id, materialLibrary.id))
      .where(and(eq(productMaterials.product_id, validatedId), isNull(productMaterials.effective_to)))
      .orderBy(materialLibrary.name)
  })

  const bucket = getProductsBucket()

  const composition = await Promise.all(
    rows.map(async (row) => {
      let disassembly_photo_urls: string[] = []
      if (row.disassembly_photo_paths && row.disassembly_photo_paths.length > 0) {
        disassembly_photo_urls = await Promise.all(
          row.disassembly_photo_paths.map(async (path) => {
            try {
              const { data } = await bucket.createSignedUrl(path, 3600)
              return data?.signedUrl ?? ''
            } catch {
              return ''
            }
          })
        )
        disassembly_photo_urls = disassembly_photo_urls.filter(Boolean)
      }
      return {
        id: row.id,
        material_library_id: row.material_library_id,
        material_name: row.material_name,
        weight_grams: row.weight_grams,
        recycling_cost_per_kg_eur: row.recycling_cost_per_kg_eur,
        recycling_cost_per_kg_dkk: row.recycling_cost_per_kg_dkk,
        recycling_outcome: row.recycling_outcome,
        disassembly_photo_urls,
      }
    })
  )

  return { composition }
}

const compositionLineSchema = z.object({
  material_library_id: z.string().uuid(),
  weight_grams: z.string().min(1),
  recycling_cost_per_kg_eur: z.string().optional().nullable(),
  recycling_cost_per_kg_dkk: z.string().optional().nullable(),
  recycling_outcome: z
    .enum(['recycled', 'reprocessed', 'incinerated', 'landfill'])
    .optional()
    .nullable(),
})

export async function saveMaterialComposition(
  productId: string,
  lines: Array<{
    material_library_id: string
    weight_grams: string
    recycling_cost_per_kg_eur?: string | null
    recycling_cost_per_kg_dkk?: string | null
    recycling_outcome?: string | null
  }>
) {
  const user = await requireRecoAdmin()
  const validatedId = z.string().uuid().parse(productId)
  const validatedLines = z.array(compositionLineSchema).parse(lines)

  await withRLSContext(user, async (tx) => {
    // 1. Fetch current composition lines to preserve disassembly photos
    const currentLines = await tx
      .select({
        material_library_id: productMaterials.material_library_id,
        disassembly_photo_paths: productMaterials.disassembly_photo_paths,
      })
      .from(productMaterials)
      .where(and(eq(productMaterials.product_id, validatedId), isNull(productMaterials.effective_to)))

    // Map material_library_id -> photo paths for photo preservation
    const photoMap = new Map<string, string[]>()
    for (const line of currentLines) {
      if (line.disassembly_photo_paths && line.disassembly_photo_paths.length > 0) {
        photoMap.set(line.material_library_id, line.disassembly_photo_paths)
      }
    }

    // 2. Close ALL current composition lines
    await tx
      .update(productMaterials)
      .set({ effective_to: new Date(), updated_at: new Date() })
      .where(and(eq(productMaterials.product_id, validatedId), isNull(productMaterials.effective_to)))

    // 3. Insert new composition lines, preserving photos where material_library_id matches
    if (validatedLines.length > 0) {
      await tx.insert(productMaterials).values(
        validatedLines.map((line) => ({
          product_id: validatedId,
          material_library_id: line.material_library_id,
          weight_grams: line.weight_grams,
          recycling_cost_per_kg_eur: line.recycling_cost_per_kg_eur ?? null,
          recycling_cost_per_kg_dkk: line.recycling_cost_per_kg_dkk ?? null,
          recycling_outcome: line.recycling_outcome as
            | 'recycled'
            | 'reprocessed'
            | 'incinerated'
            | 'landfill'
            | null
            | undefined,
          disassembly_photo_paths: photoMap.get(line.material_library_id) ?? null,
          effective_from: new Date(),
          effective_to: null,
        }))
      )
    }
  })

  revalidatePath(`/products/${validatedId}`)
  return { success: true }
}

export async function uploadMaterialPhoto(
  productId: string,
  materialLineId: string,
  formData: FormData
) {
  const user = await requireRecoAdmin()
  const validatedProductId = z.string().uuid().parse(productId)
  const validatedLineId = z.string().uuid().parse(materialLineId)

  const file = formData.get('file') as File | null
  if (!file) return { error: 'No file provided' }

  if (file.size > 5 * 1024 * 1024) return { error: 'File size must be 5MB or less' }
  if (!file.type.startsWith('image/')) return { error: 'File must be an image' }

  const tenantId = user.tenant_id ?? ''

  // Check existing photo count on the material line
  const [line] = await withRLSContext(user, async (tx) => {
    return tx
      .select({ disassembly_photo_paths: productMaterials.disassembly_photo_paths })
      .from(productMaterials)
      .where(eq(productMaterials.id, validatedLineId))
      .limit(1)
  })

  if (!line) return { error: 'Material line not found' }
  if (line.disassembly_photo_paths && line.disassembly_photo_paths.length >= 2) {
    return { error: 'Maximum 2 disassembly photos allowed per material line' }
  }

  const filename = `${Date.now()}-${file.name}`
  const filePath = getMaterialPhotoPath(tenantId, validatedProductId, validatedLineId, filename)
  const bucket = getProductsBucket()

  const arrayBuffer = await file.arrayBuffer()
  const { error } = await bucket.upload(filePath, arrayBuffer, { contentType: file.type })
  if (error) return { error: `Upload failed: ${error.message}` }

  await withRLSContext(user, async (tx) => {
    await tx
      .update(productMaterials)
      .set({
        disassembly_photo_paths: sql`array_append(disassembly_photo_paths, ${filePath})`,
        updated_at: new Date(),
      })
      .where(eq(productMaterials.id, validatedLineId))
  })

  revalidatePath(`/products/${validatedProductId}`)
  return { success: true }
}

export async function deleteMaterialPhoto(
  productId: string,
  materialLineId: string,
  photoPath: string
) {
  const user = await requireRecoAdmin()
  const validatedProductId = z.string().uuid().parse(productId)
  const validatedLineId = z.string().uuid().parse(materialLineId)

  const bucket = getProductsBucket()
  const { error } = await bucket.remove([photoPath])
  if (error) return { error: `Delete failed: ${error.message}` }

  await withRLSContext(user, async (tx) => {
    await tx
      .update(productMaterials)
      .set({
        disassembly_photo_paths: sql`array_remove(disassembly_photo_paths, ${photoPath})`,
        updated_at: new Date(),
      })
      .where(eq(productMaterials.id, validatedLineId))
  })

  revalidatePath(`/products/${validatedProductId}`)
  return { success: true }
}

// --- Pricing ---

export async function getPricingHistory(productId: string) {
  const validatedId = z.string().uuid().parse(productId)
  const claims = await getSessionClaims()

  const rows = await withRLSContext(claims, async (tx) => {
    return tx
      .select({
        id: productPricing.id,
        price_eur: productPricing.price_eur,
        price_dkk: productPricing.price_dkk,
        effective_from: productPricing.effective_from,
        effective_to: productPricing.effective_to,
      })
      .from(productPricing)
      .where(eq(productPricing.product_id, validatedId))
      .orderBy(sql`${productPricing.effective_from} DESC`)
  })

  return { pricing: rows }
}

const pricingSchema = z.object({
  product_id: z.string().uuid(),
  price_eur: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a valid decimal number')
    .optional()
    .nullable(),
  price_dkk: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a valid decimal number')
    .optional()
    .nullable(),
  effective_from: z.string().datetime({ offset: true }).or(z.string().date()),
})

export async function createPricingRecord(data: {
  product_id: string
  price_eur?: string | null
  price_dkk?: string | null
  effective_from: string
}) {
  const user = await requireRecoAdmin()
  const parsed = pricingSchema.parse(data)

  if (!parsed.price_eur && !parsed.price_dkk) {
    return { error: 'At least one of EUR or DKK price is required' }
  }

  const newEffectiveFrom = new Date(parsed.effective_from)

  const result = await withRLSContext(user, async (tx) => {
    // 1. Find current record (effective_to IS NULL)
    const [current] = await tx
      .select({
        id: productPricing.id,
        effective_from: productPricing.effective_from,
      })
      .from(productPricing)
      .where(and(eq(productPricing.product_id, parsed.product_id), isNull(productPricing.effective_to)))
      .limit(1)

    // 2. Validate: new effective_from must be after current effective_from
    if (current && newEffectiveFrom <= current.effective_from) {
      return { error: 'New effective date must be after the current record effective date' }
    }

    // 3. Close current record: effective_to = newEffectiveFrom - 1 day
    if (current) {
      const closeDate = new Date(newEffectiveFrom)
      closeDate.setDate(closeDate.getDate() - 1)
      await tx
        .update(productPricing)
        .set({ effective_to: closeDate, updated_at: new Date() })
        .where(eq(productPricing.id, current.id))
    }

    // 4. Insert new pricing record
    await tx.insert(productPricing).values({
      product_id: parsed.product_id,
      price_eur: parsed.price_eur ?? null,
      price_dkk: parsed.price_dkk ?? null,
      effective_from: newEffectiveFrom,
      effective_to: null,
    })

    return { success: true }
  })

  if (result && 'error' in result) return result

  revalidatePath(`/products/${parsed.product_id}`)
  return { success: true }
}
