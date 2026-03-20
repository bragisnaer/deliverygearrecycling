import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth-guard'
import { getDispatchDetail, updateDispatchStatus, VALID_TRANSITIONS } from '../actions'
import { EditedIndicator } from '@/components/edited-indicator'
import { VoidDispatchButton } from './void-dispatch-button'

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    created: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    picked_up: 'bg-blue-100 text-blue-800 border-blue-200',
    delivered: 'bg-green-100 text-green-800 border-green-200',
  }
  const labels: Record<string, string> = {
    created: 'Created',
    picked_up: 'Picked Up',
    delivered: 'Delivered',
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

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface DispatchDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OpsDispatchDetailPage({ params }: DispatchDetailPageProps) {
  await requireAuth(['reco-admin', 'reco'])
  const { id } = await params
  const dispatch = await getDispatchDetail(id)

  if (!dispatch) {
    notFound()
  }

  const allowedNextStatuses = VALID_TRANSITIONS[dispatch.status] ?? []
  const canMarkPickedUp = allowedNextStatuses.includes('picked_up')
  const canMarkDelivered = allowedNextStatuses.includes('delivered')

  // isEdited: updated_at differs meaningfully from created_at (>1s gap indicates an update)
  const isEdited =
    dispatch.updated_at.getTime() - dispatch.created_at.getTime() > 1000

  return (
    <div className="max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link href="/dispatch" className="hover:text-foreground hover:underline">
          Dispatches
        </Link>
        <span>/</span>
        <span className="font-mono text-foreground">{formatDate(dispatch.dispatch_date)}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
            Dispatch — {dispatch.destination}
          </h1>
          <div className="flex items-center gap-3">
            <StatusBadge status={dispatch.status} />
            <EditedIndicator isEdited={isEdited} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canMarkPickedUp && (
            <form
              action={async () => {
                'use server'
                await updateDispatchStatus(id, 'picked_up')
              }}
            >
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 font-mono text-[13px] font-medium text-white transition-colors hover:bg-blue-700"
              >
                Mark Picked Up
              </button>
            </form>
          )}
          {canMarkDelivered && (
            <form
              action={async () => {
                'use server'
                await updateDispatchStatus(id, 'delivered')
              }}
            >
              <button
                type="submit"
                className="inline-flex h-9 items-center rounded-md bg-green-600 px-4 font-mono text-[13px] font-medium text-white transition-colors hover:bg-green-700"
              >
                Mark Delivered
              </button>
            </form>
          )}
          <VoidDispatchButton dispatchId={id} destination={dispatch.destination} />
        </div>
      </div>

      {/* Dispatch details */}
      <section className="space-y-4 rounded-xl border border-border p-6">
        <h2 className="text-[16px] font-semibold">Details</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-[14px]">
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Dispatch Date
            </dt>
            <dd className="mt-1">{formatDate(dispatch.dispatch_date)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Destination
            </dt>
            <dd className="mt-1">{dispatch.destination}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Carrier
            </dt>
            <dd className="mt-1">{dispatch.carrier ?? '—'}</dd>
          </div>
          <div>
            <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
              Created
            </dt>
            <dd className="mt-1">{formatDate(dispatch.created_at)}</dd>
          </div>
          {dispatch.notes && (
            <div className="col-span-2">
              <dt className="font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
                Notes
              </dt>
              <dd className="mt-1 text-[14px]">{dispatch.notes}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Packing list */}
      <section className="space-y-4">
        <h2 className="text-[16px] font-semibold">Packing List</h2>
        {dispatch.lines.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">No packing list lines.</p>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
                  Product
                </th>
                <th className="pb-2 font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
                  Size
                </th>
                <th className="pb-2 font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
                  SKU Code
                </th>
                <th className="pb-2 text-right font-mono text-[12px] text-muted-foreground uppercase tracking-wide">
                  Quantity
                </th>
              </tr>
            </thead>
            <tbody>
              {dispatch.lines.map((line) => (
                <tr key={line.id} className="border-b border-border last:border-0">
                  <td className="py-3">{line.product_name ?? '—'}</td>
                  <td className="py-3 font-mono text-[13px] text-muted-foreground">
                    {line.size_bucket ?? '—'}
                  </td>
                  <td className="py-3 font-mono text-[13px] text-muted-foreground">
                    {line.sku_code ?? '—'}
                  </td>
                  <td className="py-3 text-right">{line.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
