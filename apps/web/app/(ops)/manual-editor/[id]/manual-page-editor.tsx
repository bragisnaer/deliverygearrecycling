'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { saveManualPage, togglePublish, deleteManualPage } from '../actions'

type ManualPage = {
  id: string
  title: string
  content_md: string
  published: boolean
  context: 'client' | 'prison'
  slug: string
}

type ManualPageVersion = {
  id: string
  content_md: string
  saved_at: Date
}

type Props = {
  page: ManualPage
  versions: ManualPageVersion[]
}

export function ManualPageEditor({ page, versions }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState(page.title)
  const [contentMd, setContentMd] = useState(page.content_md)
  const [isSaving, setIsSaving] = useState(false)
  const [showVersions, setShowVersions] = useState(false)

  async function handleSave() {
    setIsSaving(true)
    try {
      await saveManualPage(page.id, contentMd, title)
      toast.success('Page saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTogglePublish() {
    try {
      await togglePublish(page.id, !page.published)
      toast.success(page.published ? 'Page unpublished' : 'Page published')
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update publish status')
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${page.title}"? This cannot be undone.`)) return
    try {
      await deleteManualPage(page.id)
      router.push('/manual-editor')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete page')
    }
  }

  function handleRestore(versionContent: string) {
    setContentMd(versionContent)
    toast.info('Version restored — click Save to apply')
  }

  return (
    <div className="space-y-4">
      {/* Title input */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-10 w-full rounded-md border border-border bg-background px-3 font-heading text-[16px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        placeholder="Page title"
      />

      {/* Editor + Preview side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Markdown editor */}
        <div className="space-y-3">
          <label className="block text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
            Markdown
          </label>
          <textarea
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            className="min-h-[500px] w-full resize-vertical rounded-md border border-border bg-background p-3 font-mono text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Write markdown content here…"
          />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex h-8 items-center rounded-md bg-foreground px-4 font-mono text-[12px] text-background disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>

            <button
              type="button"
              onClick={handleTogglePublish}
              className="inline-flex h-8 items-center rounded-md border border-border bg-background px-4 font-mono text-[12px] text-foreground hover:bg-muted"
            >
              {page.published ? 'Unpublish' : 'Publish'}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="ml-auto inline-flex h-8 items-center rounded-md border border-destructive/30 bg-background px-4 font-mono text-[12px] text-destructive hover:bg-destructive/10"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="space-y-3">
          <label className="block text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
            Preview
          </label>
          {/* TODO: Replace with ReactMarkdown after react-markdown install (Plan 05) */}
          <pre className="min-h-[500px] w-full overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 font-sans text-sm text-foreground">
            {contentMd || <span className="text-muted-foreground">Nothing to preview yet.</span>}
          </pre>
        </div>
      </div>

      {/* Version History panel */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowVersions((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 font-mono text-[12px] text-foreground hover:bg-muted"
        >
          {showVersions ? 'Hide' : 'Show'} Version History
          {versions.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px]">
              {versions.length}
            </span>
          )}
        </button>

        {showVersions && (
          <div className="rounded-xl border border-border">
            {versions.length === 0 ? (
              <p className="px-4 py-6 text-center text-[13px] text-muted-foreground">
                No version history yet. Versions are created when you save changed content.
              </p>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Saved at
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                      Preview
                    </th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-muted-foreground">
                        {new Date(v.saved_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {v.content_md.slice(0, 100)}
                        {v.content_md.length > 100 && '…'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRestore(v.content_md)}
                          className="font-mono text-[12px] text-primary hover:underline"
                        >
                          Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
