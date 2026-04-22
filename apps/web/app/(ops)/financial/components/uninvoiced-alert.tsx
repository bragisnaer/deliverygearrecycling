import Link from 'next/link'
import { cookies } from 'next/headers'
import { db, systemSettings } from '@repo/db'
import { getUninvoicedAlerts } from '../actions'
import { formatCurrency } from '../utils'

export default async function UninvoicedAlert() {
  const cookieStore = await cookies()
  const currency = (cookieStore.get('display_currency')?.value as 'EUR' | 'DKK') ?? 'EUR'

  // Read exchange rate from system_settings via raw db (non-sensitive, no RLS needed)
  const settingsRows = await db.select({ exchange_rate_eur_dkk: systemSettings.exchange_rate_eur_dkk }).from(systemSettings).limit(1)
  const exchangeRate = settingsRows[0]?.exchange_rate_eur_dkk ?? '7.4600'

  const { overdue_count, overdue_total_eur, monthly_uninvoiced_eur } = await getUninvoicedAlerts()

  if (overdue_count === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-heading text-[15px] font-semibold text-red-800">
            Uninvoiced Deliveries
          </h3>
          <p className="text-[13px] text-red-700">
            {overdue_count} {overdue_count === 1 ? 'delivery' : 'deliveries'} older than 14 days remain uninvoiced
          </p>
          <p className="font-mono text-[13px] text-red-700">
            Overdue total: {formatCurrency(overdue_total_eur, currency, exchangeRate)}
          </p>
          <p className="font-mono text-[13px] text-red-600">
            Uninvoiced this month: {formatCurrency(monthly_uninvoiced_eur, currency, exchangeRate)}
          </p>
        </div>
        <Link
          href="/financial?status=not_invoiced"
          className="shrink-0 font-mono text-[12px] font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
        >
          View all uninvoiced
        </Link>
      </div>
    </div>
  )
}
