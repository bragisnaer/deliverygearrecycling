import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { sql } from 'drizzle-orm'
import { testDb } from './setup'

describe('Schema assertions', () => {
  it('tenant_id index exists on users table', async () => {
    const result = await testDb.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'users' AND indexdef LIKE '%tenant_id%'
    `)
    const rows = result as unknown as Array<{ indexname: string }>
    expect(rows.length).toBeGreaterThan(0)
  })

  it('user_role enum contains all six roles', async () => {
    const result = await testDb.execute(sql`
      SELECT unnest(enum_range(NULL::user_role))::text AS role
    `)
    const roles = (result as unknown as Array<{ role: string }>).map(r => r.role)

    expect(roles).toContain('reco-admin')
    expect(roles).toContain('reco')
    expect(roles).toContain('client')
    expect(roles).toContain('client-global')
    expect(roles).toContain('transport')
    expect(roles).toContain('prison')
    expect(roles).toHaveLength(6)
  })

  it('RLS is enabled on users table', async () => {
    const result = await testDb.execute(sql`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class WHERE relname = 'users'
    `)
    const rows = result as unknown as Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
    expect(rows[0]?.relrowsecurity).toBe(true)
    expect(rows[0]?.relforcerowsecurity).toBe(true)
  })

  it('RLS is enabled on prison_facilities table', async () => {
    const result = await testDb.execute(sql`
      SELECT relrowsecurity, relforcerowsecurity
      FROM pg_class WHERE relname = 'prison_facilities'
    `)
    const rows = result as unknown as Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
    expect(rows[0]?.relrowsecurity).toBe(true)
    expect(rows[0]?.relforcerowsecurity).toBe(true)
  })

  it('audit_log table exists with required columns', async () => {
    const result = await testDb.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'audit_log'
      ORDER BY ordinal_position
    `)
    const columns = (result as unknown as Array<{ column_name: string }>).map(r => r.column_name)

    expect(columns).toContain('table_name')
    expect(columns).toContain('record_id')
    expect(columns).toContain('old_data')
    expect(columns).toContain('new_data')
    expect(columns).toContain('changed_by')
    expect(columns).toContain('changed_at')
  })

  // PROD-01: products table (active — table created in 03-02)
  it('products table exists with required columns', async () => {
    const result = await testDb.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position
    `)
    const columns = (result as unknown as Array<{ column_name: string }>).map(r => r.column_name)

    expect(columns).toContain('id')
    expect(columns).toContain('tenant_id')
    expect(columns).toContain('name')
    expect(columns).toContain('product_code')
    expect(columns).toContain('processing_stream')
    expect(columns).toContain('weight_grams')
    expect(columns).toContain('active')
    expect(columns).toContain('created_at')
    expect(columns).toContain('updated_at')
  })

  // PROD-06: material_library table (active — table created in 03-01)
  it('material_library table exists with required columns', async () => {
    const result = await testDb.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'material_library'
      ORDER BY ordinal_position
    `)
    const columns = (result as unknown as Array<{ column_name: string }>).map(r => r.column_name)

    expect(columns).toContain('id')
    expect(columns).toContain('name')
    expect(columns).toContain('created_at')
    expect(columns).toContain('updated_at')
  })

  // PROD-08: product_group column (active — table created in 03-02)
  it('products table has product_group column', async () => {
    const result = await testDb.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'product_group'
    `)
    const rows = result as unknown as Array<{ column_name: string }>
    expect(rows.length).toBe(1)
  })

  it('no service_role or superuser references in API routes', () => {
    const apiDir = join(__dirname, '../../../../apps/web/app/api')

    function getAllFiles(dir: string): string[] {
      const entries = readdirSync(dir, { withFileTypes: true })
      return entries.flatMap(entry => {
        const fullPath = join(dir, entry.name)
        return entry.isDirectory() ? getAllFiles(fullPath) : [fullPath]
      })
    }

    const files = getAllFiles(apiDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))
    const forbidden = ['service_role', 'SUPABASE_SERVICE_ROLE', 'postgresql://postgres:postgres@']

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      for (const term of forbidden) {
        expect(
          content,
          `Found forbidden term "${term}" in ${file}`
        ).not.toContain(term)
      }
    }
  })
})
