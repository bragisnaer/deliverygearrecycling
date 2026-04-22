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
    const result = await signIn('resend', { email, callbackUrl: '/', redirect: false })
    if (result?.error) {
      setError('Magic link unavailable. Please use password sign-in.')
    } else {
      setSubmitted(true)
    }
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9F4]">
        <div className="w-full max-w-sm space-y-4 px-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="font-heading text-[18px] font-semibold text-black">Check your inbox</h2>
          <p className="font-mono text-[13px] text-[#9FA4A6]">
            We sent a sign-in link to <span className="text-black">{email}</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-[#FAF9F4]">
      {/* Left panel — branding */}
      <div className="hidden w-1/2 flex-col justify-between bg-black p-12 lg:flex">
        <div>
          <span className="font-heading text-[22px] font-semibold tracking-tight text-white">reco</span>
        </div>
        <div className="space-y-4">
          <p className="font-heading text-[32px] font-semibold leading-tight text-white">
            Delivery gear,<br />recycled right.
          </p>
          <p className="font-mono text-[13px] text-[#9FA4A6]">
            Track pickups, manage transport, and report impact — all in one place.
          </p>
        </div>
        <p className="font-mono text-[12px] text-[#9FA4A6]">© {new Date().getFullYear()} reco</p>
      </div>

      {/* Right panel — form */}
      <div className="flex w-full flex-col items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden">
            <span className="font-heading text-[20px] font-semibold tracking-tight text-black">reco</span>
          </div>

          <div className="space-y-1">
            <h1 className="font-heading text-[24px] font-semibold text-black">Sign in</h1>
            <p className="font-mono text-[13px] text-[#9FA4A6]">
              {mode === 'credentials' ? 'Enter your credentials to continue' : "We'll send a one-time link to your inbox"}
            </p>
          </div>

          {mode === 'credentials' ? (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="font-mono text-[12px] font-medium uppercase tracking-wider text-[#9FA4A6]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full rounded-none border border-black bg-transparent px-3 py-2.5 font-mono text-[13px] text-black placeholder:text-[#9FA4A6] focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="font-mono text-[12px] font-medium uppercase tracking-wider text-[#9FA4A6]">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-none border border-black bg-transparent px-3 py-2.5 font-mono text-[13px] text-black placeholder:text-[#9FA4A6] focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              {error && (
                <p className="font-mono text-[12px] text-[#ED1C24]">{error}</p>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full border-2 border-black bg-black px-4 py-3 font-mono text-[13px] font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('magic-link'); setError(null) }}
                  className="w-full py-2 font-mono text-[12px] text-[#9FA4A6] underline-offset-4 hover:text-black hover:underline"
                >
                  Use magic link instead
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="font-mono text-[12px] font-medium uppercase tracking-wider text-[#9FA4A6]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  className="w-full rounded-none border border-black bg-transparent px-3 py-2.5 font-mono text-[13px] text-black placeholder:text-[#9FA4A6] focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              {error && (
                <p className="font-mono text-[12px] text-[#ED1C24]">{error}</p>
              )}

              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full border-2 border-black bg-black px-4 py-3 font-mono text-[13px] font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {loading ? 'Sending…' : 'Send magic link'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('credentials'); setError(null) }}
                  className="w-full py-2 font-mono text-[12px] text-[#9FA4A6] underline-offset-4 hover:text-black hover:underline"
                >
                  Use password instead
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
