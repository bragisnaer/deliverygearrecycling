import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { auth } from '@/auth'
import { db, systemSettings } from '@repo/db'
import { getFinancialRecords } from './actions'
import { formatCurrency } from './utils'
import CurrencyToggle from './components/currency-toggle'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// Invoice status badge with color coding
function InvoiceStatusBadge({ status }: { status: 'not_invoiced' | 'invoiced' | 'paid' }) {
  const variants: Record<string, string> = {
    not_invoiced: 'bg-red-100 text-red-800 border-red-200',
    invoiced: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    paid: 'bg-green-100 text-green-800 border-green-200',
  }
  const labels: Record<string, string> = {
    not_invoiced: 'Not Invoiced',
    invoiced: 'Invoiced',
    paid: 'Paid',
  }
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[12px] font-medium',
        variants[status] ?? 'bg-gray-100 text-gray-600 border-gray-200',
      ].join(' ')}
    >
      {labels[status] ?? status}
    </span>
  )
}

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function FinancialRecordsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect('/dashboard')
  }

  const role = session.user.role
  const canViewFinancials = session.user.can_view_financials

  if (role !== 'reco-admin' && !(role === 'reco' && canViewFinancials)) {
    redirect('/dashboard')
  }

  // Read display currency from cookie (default EUR)
  const cookieStore = await cookies()
  const currency = (cookieStore.get('display_currency')?.value as 'EUR' | 'DKK') ?? 'EUR'

  // Read exchange rate from system_settings (raw db — settings non-sensitive)
  const settingsRows = await db
    .select({ exchange_rate_eur_dkk: systemSettings.exchange_rate_eur_dkk })
    .from(systemSettings)
    .limit(1)
  const exchangeRate = settingsRows[0]?.exchange_rate_eur_dkk ?? '7.4600'

  const records = await getFinancialRecords()

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">Financial Records</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Invoice status and financial details for all intake records.
          </p>
        </div>
        <CurrencyToggle currentCurrency={currency} />
      </div>

      {records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[14px] text-muted-foreground">No financial records found.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Intake Ref</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead className="text-right">Transport Cost</TableHead>
              <TableHead className="text-right">Estimated Amount</TableHead>
              <TableHead>Invoice Status</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Invoice Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => (
              <TableRow key={record.id} className="cursor-pointer hover:bg-muted/30">
                <TableCell>
                  <Link
                    href={`/financial/${record.id}`}
                    className="block font-mono text-[13px] hover:underline"
                  >
                    {record.intake_reference}
                  </Link>
                </TableCell>
                <TableCell className="text-[13px]">{record.tenant_name}</TableCell>
                <TableCell className="font-mono text-[13px]">
                  {formatDate(record.delivery_date)}
                </TableCell>
                <TableCell className="text-right font-mono text-[13px]">
                  {formatCurrency(record.transport_cost_eur, currency, exchangeRate)}
                </TableCell>
                <TableCell className="text-right font-mono text-[13px]">
                  {formatCurrency(record.estimated_invoice_amount_eur, currency, exchangeRate)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <InvoiceStatusBadge status={record.invoice_status} />
                    {record.is_imported && (
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[12px] font-medium bg-blue-100 text-blue-800 border-blue-200">
                        Imported
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">
                  {record.invoice_number ?? '—'}
                </TableCell>
                <TableCell className="font-mono text-[13px] text-muted-foreground">
                  {formatDate(record.invoice_date)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
