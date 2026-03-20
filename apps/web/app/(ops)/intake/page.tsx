import Link from 'next/link'
import { requireAuth } from '@/lib/auth-guard'
import { getIntakeQueue } from './actions'
import { IntakeQueueTable } from './components/intake-queue-table'

const INTAKE_TABS = [
  { label: 'All', value: undefined },
  { label: 'Discrepancy Flagged', value: 'discrepancy' },
  { label: 'Quarantine Blocked', value: 'quarantine' },
  { label: 'Unexpected', value: 'unexpected' },
] as const

type TabValue = 'discrepancy' | 'quarantine' | 'unexpected' | undefined

interface IntakePageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function OpsIntakePage({ searchParams }: IntakePageProps) {
  await requireAuth(['reco-admin', 'reco'])

  const { tab } = await searchParams
  const activeTab = (['discrepancy', 'quarantine', 'unexpected'].includes(tab ?? '')
    ? tab
    : undefined) as TabValue

  const intakes = await getIntakeQueue(activeTab)

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">Intake Queue</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Monitor all intake activity, review discrepancies, and manage quarantine overrides.
          </p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {INTAKE_TABS.map((tabDef) => {
          const isActive =
            tabDef.value === activeTab ||
            (tabDef.value === undefined && !activeTab)
          const href = tabDef.value ? `/intake?tab=${tabDef.value}` : '/intake'
          return (
            <Link
              key={tabDef.label}
              href={href}
              className={[
                'px-4 py-2 font-mono text-[13px] transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-foreground text-foreground font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {tabDef.label}
            </Link>
          )
        })}
      </div>

      <IntakeQueueTable intakes={intakes} />
    </div>
  )
}
