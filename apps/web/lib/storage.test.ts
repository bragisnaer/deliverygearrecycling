import { describe, it, expect } from 'vitest'
import { getProductPhotoPath, getMaterialPhotoPath } from './storage'

describe('Storage path helpers (PROD-02)', () => {
  it('getProductPhotoPath returns correct path', () => {
    const path = getProductPhotoPath('tenant-a', 'prod-123', 'photo.jpg')
    expect(path).toBe('tenant-a/products/prod-123/photos/photo.jpg')
  })

  it('getMaterialPhotoPath returns correct path', () => {
    const path = getMaterialPhotoPath('tenant-a', 'prod-123', 'mat-456', 'disassembly.jpg')
    expect(path).toBe('tenant-a/products/prod-123/materials/mat-456/disassembly.jpg')
  })

  it('paths include tenant_id to prevent cross-tenant collision', () => {
    const pathA = getProductPhotoPath('tenant-a', 'prod-1', 'x.jpg')
    const pathB = getProductPhotoPath('tenant-b', 'prod-1', 'x.jpg')
    expect(pathA).not.toBe(pathB)
  })
})
