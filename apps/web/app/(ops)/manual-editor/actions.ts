'use server'

import { auth } from '@/auth'
import { db, withRLSContext, manualPages, manualPageVersions } from '@repo/db'
import { eq, desc, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

async function getAdminUser() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'reco-admin')
    throw new Error('Unauthorized: reco-admin only')
  return { ...session.user, sub: session.user.id! }
}

export async function getManualPages() {
  const user = await getAdminUser()

  return withRLSContext(user, async (tx) => {
    return tx
      .select()
      .from(manualPages)
      .orderBy(asc(manualPages.context), asc(manualPages.display_order), asc(manualPages.title))
  })
}

export async function getManualPage(id: string) {
  const user = await getAdminUser()

  return withRLSContext(user, async (tx) => {
    const rows = await tx.select().from(manualPages).where(eq(manualPages.id, id)).limit(1)
    return rows[0] ?? null
  })
}

export async function createManualPage(data: {
  context: 'client' | 'prison'
  slug: string
  title: string
}) {
  const user = await getAdminUser()

  if (!/^[a-z0-9-]+$/.test(data.slug)) {
    throw new Error('Invalid slug: must contain only lowercase letters, numbers, and hyphens')
  }

  const rows = await withRLSContext(user, async (tx) => {
    return tx
      .insert(manualPages)
      .values({
        context: data.context,
        slug: data.slug,
        title: data.title,
        updated_by: user.sub,
      })
      .returning()
  })

  revalidatePath('/manual-editor')
  return rows[0]
}

export async function saveManualPage(id: string, contentMd: string, title: string) {
  const user = await getAdminUser()

  await withRLSContext(user, async (tx) => {
    // 1. SELECT current content
    const current = await tx
      .select({ content_md: manualPages.content_md })
      .from(manualPages)
      .where(eq(manualPages.id, id))
      .limit(1)

    const currentRow = current[0]

    // 2. Create version snapshot if content changed
    if (currentRow && currentRow.content_md !== contentMd) {
      await tx.insert(manualPageVersions).values({
        manual_page_id: id,
        content_md: currentRow.content_md,
        saved_by: user.sub,
      })
    }

    // 3. Update the page
    await tx
      .update(manualPages)
      .set({
        content_md: contentMd,
        title,
        updated_at: new Date(),
        updated_by: user.sub,
      })
      .where(eq(manualPages.id, id))
  })

  revalidatePath('/manual-editor')
}

export async function togglePublish(id: string, published: boolean) {
  const user = await getAdminUser()

  await withRLSContext(user, async (tx) => {
    await tx
      .update(manualPages)
      .set({ published, updated_at: new Date() })
      .where(eq(manualPages.id, id))
  })

  revalidatePath('/manual-editor')
  revalidatePath('/manual')
}

export async function getVersionHistory(manualPageId: string) {
  const user = await getAdminUser()

  return withRLSContext(user, async (tx) => {
    return tx
      .select()
      .from(manualPageVersions)
      .where(eq(manualPageVersions.manual_page_id, manualPageId))
      .orderBy(desc(manualPageVersions.saved_at))
      .limit(20)
  })
}

export async function deleteManualPage(id: string) {
  const user = await getAdminUser()

  await withRLSContext(user, async (tx) => {
    await tx.delete(manualPages).where(eq(manualPages.id, id))
  })

  revalidatePath('/manual-editor')
}
