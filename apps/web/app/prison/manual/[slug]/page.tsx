import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { getPrisonManualPage } from '../actions'
import { ManualRenderer } from '@/components/manual-renderer'

export default async function PrisonManualSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/prison/login')
  }
  if (session.user.role !== 'prison') {
    redirect('/prison/login')
  }

  const { slug } = await params
  const page = await getPrisonManualPage(slug)

  if (!page) {
    notFound()
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/prison/manual"
        className="font-mono text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block"
      >
        &larr; Tilbage til manual
      </Link>
      <h1 className="font-heading text-2xl font-bold mb-6">{page.title}</h1>
      <ManualRenderer content={page.content_md} />
    </div>
  )
}
