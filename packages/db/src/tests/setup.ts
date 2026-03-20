import { afterAll } from 'vitest'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from '../schema'

// Test database connection — uses DATABASE_URL_TEST env var
const testConnectionString = process.env.DATABASE_URL_TEST
if (!testConnectionString) {
  throw new Error('DATABASE_URL_TEST environment variable is required for integration tests')
}

const testClient = postgres(testConnectionString, { max: 5 })
export const testDb = drizzle(testClient, { schema })

// Seed test data for RLS tests
export async function seedTestData() {
  // Create test tenants
  await testDb.execute(sql`
    INSERT INTO tenants (id, name, active) VALUES
      ('tenant-a', 'Tenant A', true),
      ('tenant-b', 'Tenant B', true)
    ON CONFLICT (id) DO NOTHING
  `)

  // Create test users for each tenant
  await testDb.execute(sql`
    INSERT INTO users (id, email, role, tenant_id, active) VALUES
      (gen_random_uuid(), 'user-a@test.com', 'client', 'tenant-a', true),
      (gen_random_uuid(), 'user-b@test.com', 'client', 'tenant-b', true),
      (gen_random_uuid(), 'admin@test.com', 'reco-admin', NULL, true)
    ON CONFLICT (email) DO NOTHING
  `)
}

export async function cleanupTestData() {
  await testDb.execute(sql`DELETE FROM users WHERE email LIKE '%@test.com'`)
  await testDb.execute(sql`DELETE FROM tenants WHERE id IN ('tenant-a', 'tenant-b')`)
}

afterAll(async () => {
  await testClient.end()
})
