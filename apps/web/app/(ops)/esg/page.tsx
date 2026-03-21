import { getEsgData, getProcessingStreamCounts, getEsgTenants } from './actions'
import { calculateReuseRate } from '@/lib/esg-calculator'
import EsgSummaryCard from './components/esg-summary-card'
import MaterialBreakdownTable from './components/material-breakdown-table'
import MethodologyBlock from './components/methodology-block'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams: Promise<{ tenant?: string; date_from?: string; date_to?: string }>
}

export default async function EsgPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tenantFilter = params.tenant || undefined
  const dateFrom = params.date_from || undefined
  const dateTo = params.date_to || undefined

  const [esgData, streamCounts, tenants] = await Promise.all([
    getEsgData(tenantFilter, dateFrom, dateTo),
    getProcessingStreamCounts(tenantFilter),
    getEsgTenants(),
  ])

  const reuseRate = calculateReuseRate(streamCounts.total_qty, streamCounts.reuse_qty)

  const totalWeightKg = esgData.materials.reduce(
    (sum, row) => sum + row.total_weight_kg,
    0
  )

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ESG Metrics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Material recycling totals, reuse rates, and environmental impact data.
        </p>
      </div>

      {/* Tenant filter */}
      <form method="GET" className="flex items-center gap-3">
        <label htmlFor="tenant" className="font-mono text-[13px] text-muted-foreground">
          Client
        </label>
        <select
          id="tenant"
          name="tenant"
          defaultValue={tenantFilter ?? ''}
          className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All clients</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {dateFrom !== undefined && (
          <input type="hidden" name="date_from" value={dateFrom} />
        )}
        {dateTo !== undefined && (
          <input type="hidden" name="date_to" value={dateTo} />
        )}
        <button
          type="submit"
          className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-[13px] hover:bg-muted transition-colors"
        >
          Filter
        </button>
        {tenantFilter && (
          <a
            href="/esg"
            className="font-mono text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Clear
          </a>
        )}
      </form>

      {/* Summary cards — row of 3 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EsgSummaryCard
          title="Total Items Processed"
          value={esgData.totalItems.toLocaleString()}
          subtitle="From non-voided intake records"
        />
        <EsgSummaryCard
          title="Total Material Weight"
          value={`${totalWeightKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`}
          subtitle="Across all material types"
        />
        <EsgSummaryCard
          title="Reuse Rate"
          value={`${reuseRate}%`}
          subtitle="Items processed in reuse stream"
        />
      </div>

      {/* CO2 avoided — pending */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <EsgSummaryCard
          title="CO2 Avoided"
          value="Formula pending"
          subtitle="ESG-04: formula not yet defined"
          pending={esgData.co2.formula_pending}
        />
      </div>

      {/* Material breakdown table */}
      <div className="space-y-3">
        <h2 className="font-heading text-[15px] font-semibold">Material Breakdown</h2>
        <MaterialBreakdownTable rows={esgData.materials} />
      </div>

      {/* Methodology block */}
      <MethodologyBlock
        formula="Material weight = product_materials.weight_grams x intake_lines.actual_quantity / 1000"
        inputs={[
          {
            label: 'weight_grams',
            value:
              'Per-material weight from product_materials, using temporal join (effective_from / effective_to) to match the rate active at delivery date',
          },
          {
            label: 'actual_quantity',
            value:
              'Item count confirmed by prison staff during intake, from intake_lines',
          },
          {
            label: 'Voided records',
            value: 'Excluded — only non-voided intake_records are included in calculations',
          },
          {
            label: 'Reuse rate',
            value:
              'Calculated from processing_report_lines: items in reuse stream / total items processed',
          },
          {
            label: 'CO2 avoided',
            value:
              'Pending — per-material CO2 factors not yet agreed with reco/Wolt (ESG-04 blocker)',
          },
        ]}
      />

      {/* Export links */}
      <div className="flex items-center gap-4 border-t border-border pt-4">
        <span className="font-mono text-[13px] text-muted-foreground">Export:</span>
        <a
          href="/esg/export?format=csv"
          className="font-mono text-[13px] underline underline-offset-2 hover:text-muted-foreground"
        >
          Download CSV
        </a>
        <a
          href="/esg/export?format=pdf"
          className="font-mono text-[13px] underline underline-offset-2 hover:text-muted-foreground"
        >
          Download PDF
        </a>
      </div>
    </div>
  )
}
