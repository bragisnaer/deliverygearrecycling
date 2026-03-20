'use server'

import { auth } from '@/auth'
import { db, pickups, pickupLines, products, locations, withRLSContext } from '@repo/db'
import { eq, and, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Auth helpers ---

async function requireClient() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Unauthorized: not authenticated')
  }
  const { role } = session.user
  if (role !== 'client' && role !== 'client-global') {
    throw new Error('Unauthorized: client or client-global role required')
  }
  return {
    ...session.user,
    // JWTClaims requires sub — next-auth stores the user id as session.user.id (= token.sub)
    sub: session.user.id!,
  }
}

// --- Validation ---

const lineSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(0),
})

const pickupFormSchema = z.object({
  preferred_date: z
    .string()
    .min(1, 'Preferred date is required')
    .transform((v) => new Date(v)),
  pallet_count: z.number().int().min(1, 'At least one pallet is required'),
  pallet_dimensions: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one product line is required'),
})

// --- Helpers ---

/**
 * Parse FormData with lines[] entries into the shape the schema expects.
 * FormData encodes lines as: lines[0][product_id], lines[0][quantity], etc.
 */
function parseFormDataToInput(formData: FormData): Record<string, unknown> {
  const linesMap = new Map<number, { product_id?: string; quantity?: number }>()

  for (const [key, value] of formData.entries()) {
    const lineMatch = key.match(/^lines\[(\d+)\]\[(\w+)\]$/)
    if (lineMatch) {
      const index = parseInt(lineMatch[1], 10)
      const field = lineMatch[2]
      if (!linesMap.has(index)) linesMap.set(index, {})
      const entry = linesMap.get(index)!
      if (field === 'product_id') entry.product_id = value as string
      if (field === 'quantity') entry.quantity = parseInt(value as string, 10)
    }
  }

  const lines = Array.from(linesMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v)

  return {
    preferred_date: formData.get('preferred_date') as string,
    pallet_count: parseInt(formData.get('pallet_count') as string, 10),
    pallet_dimensions: (formData.get('pallet_dimensions') as string) || undefined,
    notes: (formData.get('notes') as string) || undefined,
    lines,
  }
}

// --- Server Action ---

export async function submitPickupRequest(formData: FormData) {
  const user = await requireClient()

  // Parse and validate form data
  const raw = parseFormDataToInput(formData)
  const parseResult = pickupFormSchema.safeParse(raw)
  if (!parseResult.success) {
    return { error: parseResult.error.issues[0]?.message ?? 'Invalid form data' }
  }

  const { preferred_date, pallet_count, pallet_dimensions, notes, lines } = parseResult.data

  // 72-hour lead time validation
  const minDate = new Date(Date.now() + 72 * 60 * 60 * 1000)
  if (preferred_date < minDate) {
    return { error: 'Preferred date must be at least 72 hours from now' }
  }

  // Filter lines to only those with quantity > 0
  const activeLines = lines.filter((l) => l.quantity > 0)
  if (activeLines.length === 0) {
    return { error: 'At least one product must have a quantity greater than zero' }
  }

  // Fetch user's location
  const locationId = user.location_id
  if (!locationId) {
    return { error: 'Your account has no location assigned. Please contact support.' }
  }

  const locationRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: locations.id,
        name: locations.name,
        address: locations.address,
        tenant_id: locations.tenant_id,
      })
      .from(locations)
      .where(eq(locations.id, locationId))
      .limit(1)
  })

  const location = locationRows[0]
  if (!location) {
    return { error: 'Location not found' }
  }

  // Fetch product weights for the active lines
  const activeProductIds = activeLines.map((l) => l.product_id)
  const productRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ id: products.id, weight_grams: products.weight_grams })
      .from(products)
      .where(inArray(products.id, activeProductIds))
  })

  // Build weight lookup map
  const productWeightMap = new Map<string, number>()
  for (const p of productRows) {
    productWeightMap.set(p.id, parseFloat(p.weight_grams ?? '0'))
  }

  // Calculate estimated weight: SUM(weight_grams * quantity) + (pallet_count * 25000)
  const STANDARD_PALLET_WEIGHT_GRAMS = 25000
  let productWeightTotal = 0
  for (const line of activeLines) {
    const weight = productWeightMap.get(line.product_id) ?? 0
    productWeightTotal += weight * line.quantity
  }
  const estimatedWeightGrams = productWeightTotal + pallet_count * STANDARD_PALLET_WEIGHT_GRAMS

  const tenantId = user.tenant_id
  if (!tenantId) {
    return { error: 'Your account has no tenant assigned. Please contact support.' }
  }

  // Insert pickup record
  const insertedPickup = await withRLSContext(user, async (tx) => {
    return tx
      .insert(pickups)
      .values({
        tenant_id: tenantId,
        location_id: locationId,
        reference: '', // overwritten by DB trigger to PU-YYYY-NNNN
        pallet_count,
        pallet_dimensions: pallet_dimensions ?? null,
        estimated_weight_grams: estimatedWeightGrams.toFixed(2),
        preferred_date,
        notes: notes ?? null,
        submitted_by: user.sub,
      })
      .returning({ id: pickups.id })
  })

  const pickupId = insertedPickup[0]?.id
  if (!pickupId) {
    return { error: 'Failed to create pickup record' }
  }

  // Insert pickup lines
  await withRLSContext(user, async (tx) => {
    return tx.insert(pickupLines).values(
      activeLines.map((line) => ({
        pickup_id: pickupId,
        product_id: line.product_id,
        quantity: line.quantity,
      }))
    )
  })

  // SELECT back to get the trigger-generated reference (PU-YYYY-NNNN)
  const pickupRefRows = await withRLSContext(user, async (tx) => {
    return tx
      .select({ reference: pickups.reference })
      .from(pickups)
      .where(eq(pickups.id, pickupId))
      .limit(1)
  })

  const reference = pickupRefRows[0]?.reference ?? ''

  revalidatePath('/pickups')
  return { success: true, reference, pickupId }
}
