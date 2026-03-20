// Server-side only — SUPABASE_SERVICE_ROLE_KEY must never be exposed to client
import { StorageClient } from '@supabase/storage-js'

// Lazy-initialised so unit tests that only use path helpers can import this
// module without requiring SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY to be set.
let _storageClient: StorageClient | undefined

export function getStorageClient(): StorageClient {
  if (!_storageClient) {
    const STORAGE_URL = `${process.env.SUPABASE_URL}/storage/v1`
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
    _storageClient = new StorageClient(STORAGE_URL, {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    })
  }
  return _storageClient
}

/** Returns the initialized StorageClient. Call only in server contexts where env vars are set. */
export function getProductsBucket() {
  return getStorageClient().from('product-photos')
}

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
