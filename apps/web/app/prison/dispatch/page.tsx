import { getDispatchHistory } from '../actions'
import { useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    created: 'bg-yellow-100 text-yellow-800',
    picked_up: 'bg-blue-100 text-blue-800',
    delivered: 'bg-green-100 text-green-800',
  }
  const labels: Record<string, string> = {
    created: 'Oprettet',
    picked_up: 'Afhentet',
    delivered: 'Leveret',
  }
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-[12px] font-medium',
        classes[status] ?? 'bg-gray-100 text-gray-600',
      ].join(' ')}
    >
      {labels[status] ?? status}
    </span>
  )
}

export default async function PrisonDispatchPage() {
  const t = await getTranslations('dispatch')
  const dispatches = await getDispatchHistory()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
          {t('history')}
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Forsendelser fra denne facilitet til genfordeling.
        </p>
      </div>

      {dispatches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-[14px] text-muted-foreground">{t('no_dispatches')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th className="px-4 py-3 font-mono text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                  {t('date')}
                </th>
                <th className="px-4 py-3 font-mono text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                  {t('destination')}
                </th>
                <th className="px-4 py-3 font-mono text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                  {t('carrier')}
                </th>
                <th className="px-4 py-3 font-mono text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-right font-mono text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
                  {t('lines')}
                </th>
              </tr>
            </thead>
            <tbody>
              {dispatches.map((dispatch) => (
                <tr
                  key={dispatch.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-[13px]">
                    {new Date(dispatch.dispatch_date).toLocaleDateString('da-DK', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-4 py-3">{dispatch.destination}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {dispatch.carrier ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={dispatch.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[13px] text-muted-foreground">
                    {dispatch.line_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
