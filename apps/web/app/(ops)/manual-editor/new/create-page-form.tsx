'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createManualPage } from '../actions'

export function CreatePageForm() {
  const router = useRouter()
  const [context, setContext] = useState<'client' | 'prison'>('client')
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleTitleChange(value: string) {
    setTitle(value)
    // Auto-generate slug from title
    const generated = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    setSlug(generated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await createManualPage({ context, slug, title })
      router.push(`/manual-editor/${result?.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create page')
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="context" className="block text-[13px] font-medium text-foreground">
          Context
        </label>
        <select
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value as 'client' | 'prison')}
          className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="client">Client Manual</option>
          <option value="prison">Prison Manual</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="title" className="block text-[13px] font-medium text-foreground">
          Title
        </label>
        <input
          id="title"
          type="text"
          required
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g. Getting Started"
          className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="slug" className="block text-[13px] font-medium text-foreground">
          Slug
          <span className="ml-2 font-normal text-muted-foreground">(auto-generated, editable)</span>
        </label>
        <input
          id="slug"
          type="text"
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. getting-started"
          className="h-9 w-full rounded-md border border-border bg-background px-3 font-mono text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-[12px] text-muted-foreground">
          Lowercase letters, numbers, and hyphens only.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting || !title || !slug}
          className="inline-flex h-9 items-center rounded-md bg-foreground px-4 font-mono text-[13px] text-background disabled:opacity-50"
        >
          {isSubmitting ? 'Creating…' : 'Create page'}
        </button>
      </div>
    </form>
  )
}
