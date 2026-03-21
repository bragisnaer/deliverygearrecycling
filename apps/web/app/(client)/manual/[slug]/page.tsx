import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getClientManualPage } from '../actions'
import { ManualRenderer } from '@/components/manual-renderer'

export default async function ClientManualSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = await getClientManualPage(slug)

  if (!page) {
    notFound()
  }

  return (
    <div className="max-w-2xl">
      <Link
        href="/manual"
        className="font-mono text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block"
      >
        &larr; Back to Manual
      </Link>
      <h1 className="font-heading text-2xl font-bold mb-6">{page.title}</h1>
      <ManualRenderer content={page.content_md} />
    </div>
  )
}
