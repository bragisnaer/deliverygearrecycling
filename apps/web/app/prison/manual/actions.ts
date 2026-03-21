'use server'

import { auth } from '@/auth'
import { withRLSContext, manualPages } from '@repo/db'
import { and, asc, eq } from 'drizzle-orm'

export async function getPrisonManualPages() {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Not authenticated')
  }
  if (session.user.role !== 'prison') {
    throw new Error('Forbidden')
  }

  const user = {
    sub: session.user.id!,
    role: session.user.role as string,
    tenant_id: session.user.tenant_id,
    location_id: session.user.location_id,
    facility_id: session.user.facility_id,
  }

  return withRLSContext(user, async (tx) => {
    return tx
      .select({
        id: manualPages.id,
        slug: manualPages.slug,
        title: manualPages.title,
        display_order: manualPages.display_order,
      })
      .from(manualPages)
      .where(
        and(
          eq(manualPages.context, 'prison'),
          eq(manualPages.published, true)
        )
      )
      .orderBy(asc(manualPages.display_order), asc(manualPages.title))
  })
}

export async function getPrisonManualPage(slug: string) {
  const session = await auth()
  if (!session?.user) {
    throw new Error('Not authenticated')
  }
  if (session.user.role !== 'prison') {
    throw new Error('Forbidden')
  }

  const user = {
    sub: session.user.id!,
    role: session.user.role as string,
    tenant_id: session.user.tenant_id,
    location_id: session.user.location_id,
    facility_id: session.user.facility_id,
  }

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .select()
      .from(manualPages)
      .where(
        and(
          eq(manualPages.context, 'prison'),
          eq(manualPages.slug, slug),
          eq(manualPages.published, true)
        )
      )
      .limit(1)
  })

  return rows[0] ?? null
}
