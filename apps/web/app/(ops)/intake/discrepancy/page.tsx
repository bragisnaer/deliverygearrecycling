import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import {
  getDiscrepancyByCountry,
  getDiscrepancyByFacility,
  getDiscrepancyByProduct,
  getMonthlyDiscrepancyByCountry,
} from '../actions'
import { DiscrepancyTabs } from './components/discrepancy-tabs'

export const dynamic = 'force-dynamic'

export default async function DiscrepancyDashboardPage() {
  // Fetch all three aggregate datasets in parallel
  const [byCountry, byProduct, byFacility] = await Promise.all([
    getDiscrepancyByCountry(),
    getDiscrepancyByProduct(),
    getDiscrepancyByFacility(),
  ])

  // Fetch monthly trend + persistent flag for each country in parallel.
  // Country count in the system is small (<20 markets) so parallel Promise.all is acceptable.
  const countryTrendEntries = await Promise.all(
    byCountry.map(async (row) => {
      const result = await getMonthlyDiscrepancyByCountry(row.country)
      return [row.country, result] as const
    })
  )
  const countryTrends = Object.fromEntries(countryTrendEntries)

  return (
    <div className="container mx-auto max-w-5xl py-8">
      <div className="mb-6">
        <Link
          href="/intake"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Intake Queue
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Discrepancy Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rolling 6-month discrepancy rates by country, product, and facility.
          Markets flagged as persistent have exceeded 15% in 3 or more of the
          last 6 months.
        </p>
      </div>

      <DiscrepancyTabs
        byCountry={byCountry}
        byProduct={byProduct}
        byFacility={byFacility}
        countryTrends={countryTrends}
      />
    </div>
  )
}
