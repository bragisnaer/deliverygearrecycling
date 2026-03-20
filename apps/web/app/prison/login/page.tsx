'use client'

import { useSearchParams } from 'next/navigation'
import { useState, Suspense } from 'react'

function PrisonLoginForm() {
  const searchParams = useSearchParams()
  const facilitySlug = searchParams.get('facility')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!facilitySlug) {
    return (
      <div className="text-center">
        <h1 className="font-heading text-xl font-semibold">Prison Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Missing facility parameter. Use the bookmarked link provided by reco.
        </p>
      </div>
    )
  }

  async function handleLogin() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/prison/send-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facility: facilitySlug }),
      })
      if (!response.ok) {
        const data = await response.json()
        setError(data.error ?? 'Failed to send login link')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Failed to send login link. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="text-center space-y-6">
      <h1 className="font-heading text-xl font-semibold">Prison Facility Login</h1>
      <p className="text-sm text-muted-foreground">
        Facility: <span className="font-semibold text-foreground">{facilitySlug}</span>
      </p>

      {submitted ? (
        <p className="text-sm text-muted-foreground">
          A login link has been sent to the facility email. Check the inbox and click the link to sign in.
        </p>
      ) : (
        <>
          <button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="rounded-md border-2 border-foreground bg-primary px-8 py-4 font-mono text-base font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send login link'}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  )
}

export default function PrisonLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm p-6">
        <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
          <PrisonLoginForm />
        </Suspense>
      </div>
    </div>
  )
}
