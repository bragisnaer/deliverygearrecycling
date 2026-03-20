import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import type { UserRole } from '@repo/types'

const OPS_ROLES: UserRole[] = ['reco-admin', 'reco', 'transport', 'prison']
const CLIENT_ROLES: UserRole[] = ['client', 'client-global']

export default async function RootPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/sign-in')
  }

  const role = session.user.role as UserRole

  if (OPS_ROLES.includes(role)) {
    redirect('/dashboard')
  }

  if (CLIENT_ROLES.includes(role)) {
    redirect('/overview')
  }

  redirect('/sign-in')
}
