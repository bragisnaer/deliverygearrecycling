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
    await tx.execute(sql`
      SELECT set_config('request.jwt.claim.sub', ${claims.sub}, TRUE);
      SELECT set_config('request.jwt.claim.role', ${claims.role}, TRUE);
      SELECT set_config('request.jwt.claim.tenant_id', ${claims.tenant_id ?? ''}, TRUE);
      SELECT set_config('request.jwt.claim.location_id', ${claims.location_id ?? ''}, TRUE);
      SELECT set_config('request.jwt.claim.facility_id', ${claims.facility_id ?? ''}, TRUE);
    `)

    // Switch to the appropriate PostgreSQL role for this transaction.
    // NOTE: The DB application user must have SET ROLE permission for these roles.
    const pgRole = mapAppRoleToPgRole(claims.role)
    if (pgRole) {
      await tx.execute(sql.raw(`SET LOCAL ROLE ${pgRole}`))
    }

    return fn(tx as unknown as typeof db)
  })
}

function mapAppRoleToPgRole(appRole: string): string | null {
  const mapping: Record<string, string> = {
    'reco-admin': 'reco_admin',
    'reco': 'reco_role',
    'client': 'client_role',
    'client-global': 'client_role',
    'transport': 'transport_role',
    'prison': 'prison_role',
  }
  return mapping[appRole] ?? null
}
