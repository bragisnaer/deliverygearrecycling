import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { getFinancialRecord, calculateAndStoreInvoiceAmount } from '../actions'
import { formatCurrency } from '../utils'
import { InvoiceEditForm } from '../components/invoice-edit-form'

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

interface FinancialDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function FinancialRecordDetailPage({ params }: FinancialDetailPageProps) {
  const session = await auth()

  if (!session?.user) {
    redirect('/dashboard')
  }

  const role = session.user.role
  const canViewFinancials = session.user.can_view_financials

  if (role !== 'reco-admin' && !(role === 'reco' && canViewFinancials)) {
    redirect('/dashboard')
  }

  const { id } = await params
  const record = await getFinancialRecord(id)

  if (!record) {
    notFound()
  }

  // Default exchange rate for display (EUR only — currency toggle is Plan 03)
  const exchangeRate = '7.4600'

  const isRecoAdmin = role === 'reco-admin'

  // Format invoice_date as ISO date string for the form input (YYYY-MM-DD)
  const invoiceDateString = record.invoice_date
    ? new Date(record.invoice_date).toISOString().split('T')[0]
    : null

  return (
    <div className="max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/financial" className="hover:text-foreground hover:underline">
          Financial Records
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground">{record.intake_reference}</span>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
          {record.intake_reference}
        </h1>
        <div className="flex items-center gap-3">
          <InvoiceStatusBadge status={record.invoice_status} />
        </div>
      </div>

      {/* Read-only intake details */}
      <section className="space-y-4 rounded-xl border border-border p-6">
        <h2 className="text-[16px] font-semibold">Intake Details</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-[14px]">
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Intake Reference
            </dt>
            <dd className="mt-1 font-mono">{record.intake_reference}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Client
            </dt>
            <dd className="mt-1">{record.tenant_name}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Delivery Date
            </dt>
            <dd className="mt-1 font-mono">{formatDate(record.delivery_date)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Record Created
            </dt>
            <dd className="mt-1 font-mono">{formatDate(record.created_at)}</dd>
          </div>
        </dl>
      </section>

      {/* Financial details with recalculate */}
      <section className="space-y-4 rounded-xl border border-border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Financial Amounts</h2>
          {isRecoAdmin && (
            <form
              action={async () => {
                'use server'
                await calculateAndStoreInvoiceAmount(record.intake_record_id)
              }}
            >
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-md border border-border px-3 font-mono text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Recalculate
              </button>
            </form>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-[14px]">
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Transport Cost
            </dt>
            <dd className="mt-1 font-mono">
              {formatCurrency(record.transport_cost_eur, 'EUR', exchangeRate)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Estimated Invoice Amount
            </dt>
            <dd className="mt-1 font-mono">
              {record.estimated_invoice_amount_eur ? (
                formatCurrency(record.estimated_invoice_amount_eur, 'EUR', exchangeRate)
              ) : (
                <span className="text-muted-foreground">
                  Not yet calculated
                  {isRecoAdmin && (
                    <span className="ml-2 text-[12px]">(use Recalculate above)</span>
                  )}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Invoice edit form — reco-admin only */}
      {isRecoAdmin && (
        <section className="space-y-4 rounded-xl border border-border p-6">
          <h2 className="text-[16px] font-semibold">Invoice Details</h2>
          <InvoiceEditForm
            id={id}
            initialValues={{
              invoice_status: record.invoice_status,
              invoice_number: record.invoice_number,
              invoice_date: invoiceDateString ?? null,
              notes: record.notes,
            }}
          />
        </section>
      )}

      {/* Read-only invoice info for reco role (can view, not edit) */}
      {!isRecoAdmin && (
        <section className="space-y-4 rounded-xl border border-border p-6">
          <h2 className="text-[16px] font-semibold">Invoice Details</h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-[14px]">
            <div>
              <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
                Invoice Number
              </dt>
              <dd className="mt-1 font-mono">{record.invoice_number ?? '—'}</dd>
            </div>
            <div>
              <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
                Invoice Date
              </dt>
              <dd className="mt-1 font-mono">{formatDate(record.invoice_date)}</dd>
            </div>
            {record.notes && (
              <div className="col-span-2">
                <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
                  Notes
                </dt>
                <dd className="mt-1">{record.notes}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
    </div>
  )
}
