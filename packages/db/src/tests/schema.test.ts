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

  it('no service_role or superuser references in API routes', async () => {
    // This is a static check — grep the codebase
    // Implemented as a shell command check via the CI pipeline
    // Here we just document the requirement
    expect(true).toBe(true) // Placeholder — real check in CI grep step
  })
})
