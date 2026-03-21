import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { db, systemSettings } from '@repo/db'
import UninvoicedAlert from '../financial/components/uninvoiced-alert'
import {
  getPickupStatusSummary,
  getConsolidationAgeing,
  getPrisonPipeline,
  getRevenueSummary,
  getDashboardTenants,
} from './actions'
import ClientContextSwitcher from './components/client-context-switcher'
import PickupStatusSummary from './components/pickup-status-summary'
import ConsolidationAgeingTable from './components/consolidation-ageing-table'
import PrisonPipelineCard from './components/prison-pipeline-card'
import RevenueSummaryCard from './components/revenue-summary-card'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ client?: string }>

export default async function OpsDashboard(props: {
  searchParams: SearchParams
}) {
  const session = await auth()
  const role = session?.user?.role
  const canViewFinancials = session?.user?.can_view_financials

  const hasFinancialAccess =
    role === 'reco-admin' || (role === 'reco' && canViewFinancials === true)

  const searchParams = await props.searchParams
  const clientFilter = searchParams.client || undefined

  // Read display currency preference from cookie
  const cookieStore = await cookies()
  const currency =
    (cookieStore.get('display_currency')?.value as 'EUR' | 'DKK') ?? 'EUR'

  // Read exchange rate from system_settings via raw db (non-sensitive, no RLS needed)
  const settingsRows = await db
    .select({ exchange_rate_eur_dkk: systemSettings.exchange_rate_eur_dkk })
    .from(systemSettings)
    .limit(1)
  const exchangeRate = settingsRows[0]?.exchange_rate_eur_dkk ?? '7.4600'

  // Parallel fetch all dashboard data
  const [pickupStatus, consolidationAgeing, prisonPipeline, revenueSummary, tenants] =
    await Promise.all([
      getPickupStatusSummary(clientFilter),
      getConsolidationAgeing(clientFilter),
      getPrisonPipeline(clientFilter),
      getRevenueSummary(clientFilter),
      getDashboardTenants(),
    ])

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header with client context switcher */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Ops Dashboard
        </h1>
        <ClientContextSwitcher
          clients={tenants}
          activeClientId={clientFilter}
        />
      </header>

      {/* Uninvoiced alert — financial access gated */}
      {hasFinancialAccess && <UninvoicedAlert />}

      {/* Pickup Status Summary */}
      <section className="rounded-xl border border-border p-5">
        <h2 className="mb-3 font-heading text-[15px] font-semibold">
          Pickup Status
        </h2>
        <PickupStatusSummary data={pickupStatus} />
      </section>

      {/* Two-column grid: Consolidation Ageing + Prison Pipeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border p-5">
          <h2 className="mb-3 font-heading text-[15px] font-semibold">
            Consolidation Ageing
          </h2>
          <ConsolidationAgeingTable data={consolidationAgeing} />
        </section>

        <section className="rounded-xl border border-border p-5">
          <h2 className="mb-3 font-heading text-[15px] font-semibold">
            Prison Pipeline
          </h2>
          <PrisonPipelineCard data={prisonPipeline} />
        </section>
      </div>

      {/* Revenue Summary — financial access gated */}
      {hasFinancialAccess && (
        <section className="rounded-xl border border-border p-5">
          <h2 className="mb-3 font-heading text-[15px] font-semibold">
            Revenue Summary
          </h2>
          <RevenueSummaryCard
            data={revenueSummary}
            currency={currency}
            exchangeRate={exchangeRate}
          />
        </section>
      )}
    </div>
  )
}
