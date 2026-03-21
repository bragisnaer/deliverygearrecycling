import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getManualPage, getVersionHistory } from '../actions'
import { ManualPageEditor } from './manual-page-editor'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ManualPageEditPage({ params }: Props) {
  const { id } = await params

  const [page, versions] = await Promise.all([getManualPage(id), getVersionHistory(id)])

  if (!page) {
    redirect('/manual-editor')
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/manual-editor" className="hover:text-foreground hover:underline">
          Manual Editor
        </Link>
        <span>/</span>
        <span className="text-foreground">{page.title}</span>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-4">
        <span className="rounded-full bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground capitalize">
          {page.context}
        </span>
        <span className="font-mono text-[12px] text-muted-foreground">/{page.slug}</span>
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${
            page.published
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {page.published ? 'Published' : 'Draft'}
        </span>
      </div>

      <ManualPageEditor page={page} versions={versions} />
    </div>
  )
}
