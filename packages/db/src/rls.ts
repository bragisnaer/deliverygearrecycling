import { db } from './db'
import { sql } from 'drizzle-orm'

interface JWTClaims {
  sub: string
  role: string
  tenant_id?: string | null
  location_id?: string | null
  facility_id?: string | null
}

/**
 * Execute a database operation within a transaction that sets RLS context
 * from JWT claims. All tenant-scoped queries MUST use this wrapper.
 *
 * The SET LOCAL statements only persist for the current transaction,
 * ensuring no JWT context leaks between requests in connection pools.
 */
export async function withRLSContext<T>(
  claims: JWTClaims,
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    // Set JWT claims as PostgreSQL session variables (transaction-scoped via TRUE = local)
    // Each set_config must be a separate execute — postgres.js forbids multiple statements
    // in a single prepared query.
    await tx.execute(sql`SELECT set_config('request.jwt.claim.sub', ${claims.sub}, TRUE)`)
    await tx.execute(sql`SELECT set_config('request.jwt.claim.role', ${claims.role}, TRUE)`)
    await tx.execute(sql`SELECT set_config('request.jwt.claim.tenant_id', ${claims.tenant_id ?? ''}, TRUE)`)
    await tx.execute(sql`SELECT set_config('request.jwt.claim.location_id', ${claims.location_id ?? ''}, TRUE)`)
    await tx.execute(sql`SELECT set_config('request.jwt.claim.facility_id', ${claims.facility_id ?? ''}, TRUE)`)

    // NOTE: SET LOCAL ROLE is intentionally omitted.
    // The pooler connection user does not have GRANT permissions for custom roles.
    // RLS is enforced exclusively via the set_config JWT claims set above.

    return fn(tx as unknown as typeof db)
  })
}

