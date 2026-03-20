'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AutoRedirectProps {
  destination: string
  delayMs?: number
}

export function AutoRedirect({ destination, delayMs = 10000 }: AutoRedirectProps) {
  const router = useRouter()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(delayMs / 1000))
  const hasRedirected = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1))
    }, 1000)

    timeoutRef.current = setTimeout(() => {
      if (!hasRedirected.current) {
        hasRedirected.current = true
        router.push(destination)
      }
    }, delayMs)

    return () => {
      // CRITICAL: clear timeout on unmount (Pitfall 7) — prevents double-navigation
      // if user taps an action button before the timer fires
      clearInterval(interval)
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [destination, delayMs, router])

  return (
    <p className="text-sm text-muted-foreground">
      Omdirigerer om {secondsLeft} sekunder…
    </p>
  )
}
