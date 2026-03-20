// Server-side only — SUPABASE_SERVICE_ROLE_KEY must never be exposed to client
import { StorageClient } from '@supabase/storage-js'

const STORAGE_URL = `${process.env.SUPABASE_URL}/storage/v1`
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const storageClient = new StorageClient(STORAGE_URL, {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
})

export const productsBucket = storageClient.from('product-photos')

/**
 * Returns the storage path for a product's photo.
 * Format: {tenantId}/products/{productId}/photos/{filename}
 */
export function getProductPhotoPath(
  tenantId: string,
  productId: string,
  filename: string
): string {
  return `${tenantId}/products/${productId}/photos/${filename}`
}

/**
 * Returns the storage path for a material's disassembly photo within a product.
 * Format: {tenantId}/products/{productId}/materials/{materialId}/{filename}
 */
export function getMaterialPhotoPath(
  tenantId: string,
  productId: string,
  materialId: string,
  filename: string
): string {
  return `${tenantId}/products/${productId}/materials/${materialId}/${filename}`
}
