'use client'

// Sets the display_currency cookie via setCurrencyPreference Server Action
import { useRouter } from 'next/navigation'
import { setCurrencyPreference } from '../actions'

interface CurrencyToggleProps {
  currentCurrency: 'EUR' | 'DKK'
}

export default function CurrencyToggle({ currentCurrency }: CurrencyToggleProps) {
  const router = useRouter()

  async function handleToggle(currency: 'EUR' | 'DKK') {
    if (currency === currentCurrency) return
    await setCurrencyPreference(currency)
    router.refresh()
  }

  return (
    <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5 font-mono text-[12px]">
      <button
        type="button"
        onClick={() => handleToggle('EUR')}
        className={[
          'rounded px-2.5 py-1 transition-colors',
          currentCurrency === 'EUR'
            ? 'bg-foreground text-background font-semibold'
            : 'text-muted-foreground hover:text-foreground',
        ].join(' ')}
        aria-pressed={currentCurrency === 'EUR'}
      >
        EUR
      </button>
      <button
        type="button"
        onClick={() => handleToggle('DKK')}
        className={[
          'rounded px-2.5 py-1 transition-colors',
          currentCurrency === 'DKK'
            ? 'bg-foreground text-background font-semibold'
            : 'text-muted-foreground hover:text-foreground',
        ].join(' ')}
        aria-pressed={currentCurrency === 'DKK'}
      >
        DKK
      </button>
    </div>
  )
}
