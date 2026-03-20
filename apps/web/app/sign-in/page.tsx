'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

type Mode = 'credentials' | 'magic-link'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<Mode>('credentials')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = await signIn('credentials', {
      email,
      password,
      callbackUrl: '/',
      redirect: false,
    })
    if (result?.error) {
      setError('Invalid email or password.')
    } else if (result?.url) {
      window.location.href = result.url
    }
    setLoading(false)
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    await signIn('resend', { email, callbackUrl: '/' })
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-8 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Check your email for a sign-in link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-8 p-6">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-semibold">Sign in to reco</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === 'credentials' ? 'Sign in with your email and password' : 'Sign in with a magic link'}
          </p>
        </div>

        {mode === 'credentials' ? (
          <form onSubmit={handleCredentials} className="space-y-4">
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
            <div>
              <label htmlFor="password" className="text-sm font-semibold">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md border-2 border-foreground bg-primary px-4 py-3 font-mono text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('magic-link'); setError(null) }}
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Use magic link instead
            </button>
          </form>
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
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md border-2 border-foreground bg-primary px-4 py-3 font-mono text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
            <button
              type="button"
              onClick={() => { setMode('credentials'); setError(null) }}
              className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Use password instead
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
