'use server'

import { auth } from '@/auth'
import { db, products, withRLSContext } from '@repo/db'
import { eq, and, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getProductsBucket, getProductPhotoPath } from '@/lib/storage'

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
