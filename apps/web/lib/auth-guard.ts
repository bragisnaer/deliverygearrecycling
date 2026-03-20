import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import type { UserRole } from '@repo/types'

interface AuthResult {
  user: {
    id: string
    role: UserRole
    tenant_id: string | null
    location_id: string | null
    facility_id: string | null
    name?: string | null
    email?: string | null
  }
}

/**
 * Server-side auth guard. Call in layout.tsx or page.tsx.
 * Redirects to /sign-in if unauthenticated.
 * Redirects to /access-denied if role is not in allowedRoles.
 */
export async function requireAuth(allowedRoles: UserRole[]): Promise<AuthResult> {
  const session = await auth()

  if (!session?.user) {
    redirect('/sign-in')
  }

  const role = session.user.role as UserRole
  if (!allowedRoles.includes(role)) {
    redirect('/access-denied')
  }

  return {
    user: {
      id: session.user.id!,
      role,
      tenant_id: session.user.tenant_id,
      location_id: session.user.location_id,
      facility_id: session.user.facility_id,
      name: session.user.name,
      email: session.user.email,
    },
  }
}
