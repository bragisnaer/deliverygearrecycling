import Link from 'next/link'
import { getManualPages } from './actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default async function ManualEditorPage() {
  const pages = await getManualPages()

  const clientPages = pages.filter((p) => p.context === 'client')
  const prisonPages = pages.filter((p) => p.context === 'prison')

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">Manual Editor</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Create and manage manual pages for clients and prison staff.
          </p>
        </div>
        <Button render={<Link href="/manual-editor/new" />}>Create new page</Button>
      </div>

      <ManualSection title="Client Manual" pages={clientPages} />
      <ManualSection title="Prison Manual" pages={prisonPages} />
    </div>
  )
}

type Page = {
  id: string
  title: string
  slug: string
  published: boolean
  display_order: number
  updated_at: Date
}

function ManualSection({ title, pages }: { title: string; pages: Page[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-[15px] font-semibold">{title}</h2>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-[14px] text-muted-foreground">No pages yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-2 text-left font-mono font-medium text-muted-foreground">
                  Slug
                </th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Order</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link
                      href={`/manual-editor/${page.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {page.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{page.slug}</td>
                  <td className="px-4 py-3 text-muted-foreground">{page.display_order}</td>
                  <td className="px-4 py-3">
                    {page.published ? (
                      <Badge variant="secondary">Published</Badge>
                    ) : (
                      <Badge variant="outline">Draft</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(page.updated_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
