type RevenueSummary = {
  total_invoiced_eur: number
  total_paid_eur: number
  total_uninvoiced_eur: number
  record_count: number
}

type RevenueSummaryCardProps = {
  data: RevenueSummary
  currency: 'EUR' | 'DKK'
  exchangeRate: string
}

function formatAmount(
  amountEur: number,
  currency: 'EUR' | 'DKK',
  exchangeRate: string
): string {
  const amount =
    currency === 'DKK' ? amountEur * Number(exchangeRate) : amountEur
  const formatted = amount.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency === 'DKK' ? `${formatted} DKK` : `\u20AC${formatted}`
}

export default function RevenueSummaryCard({
  data,
  currency,
  exchangeRate,
}: RevenueSummaryCardProps) {
  const stats = [
    {
      label: 'Invoiced',
      value: formatAmount(data.total_invoiced_eur, currency, exchangeRate),
    },
    {
      label: 'Paid',
      value: formatAmount(data.total_paid_eur, currency, exchangeRate),
    },
    {
      label: 'Uninvoiced',
      value: formatAmount(data.total_uninvoiced_eur, currency, exchangeRate),
    },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border p-4 text-center"
          >
            <p className="text-[11px] font-mono uppercase text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 font-mono text-[18px] font-semibold">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground">
        {data.record_count} financial {data.record_count === 1 ? 'record' : 'records'} total
      </p>
    </div>
  )
}
