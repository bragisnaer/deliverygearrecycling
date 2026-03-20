'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await signIn('resend', { email, callbackUrl: '/' })
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 p-6">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-semibold">Sign in to reco</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose your sign-in method
          </p>
        </div>

        {/* Entra ID for reco staff */}
        <div>
          <button
            type="button"
            onClick={() => signIn('microsoft-entra-id', { callbackUrl: '/' })}
            className="w-full rounded-md border-2 border-foreground bg-background px-4 py-3 font-mono text-sm font-medium text-foreground hover:bg-secondary"
          >
            Sign in with Microsoft (reco staff)
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Magic link for external users */}
        {submitted ? (
          <p className="text-center text-sm text-muted-foreground">
            Check your email for a sign-in link.
          </p>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label htmlFor="email" className="text-sm font-semibold">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md border-2 border-foreground bg-primary px-4 py-3 font-mono text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
