import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  getClientPickupActivity,
  getClientSentVsReceived,
  getClientVolumeByQuarter,
  getClientEsgSummary,
  getClientLocations,
} from './actions'
import PickupActivityCard from './components/pickup-activity-card'
import DiscrepancyFlag from './components/discrepancy-flag'
import VolumeByQuarterTable from './components/volume-by-quarter-table'
import EsgSummaryWidget from './components/esg-summary-widget'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{ location?: string }>

export default async function ClientDashboard(props: { searchParams: SearchParams }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/sign-in')
  }

  const role = session.user.role as string
  const isGlobal = role === 'client-global'

  // Build JWTClaims for withRLSContext
  const claims = {
    sub: session.user.id!,
    role,
    tenant_id: session.user.tenant_id ?? null,
    location_id: session.user.location_id ?? null,
  }

  // For client-global: locationId may be set via searchParam drill-down
  // For client: locationId is always from their session location_id
  const searchParams = await props.searchParams
  const locationId = isGlobal
    ? (searchParams.location ?? undefined)
    : (session.user.location_id ?? undefined)

  // Parallel data fetch
  const [pickupActivity, sentVsReceived, volumeByQuarter, esgSummary] = await Promise.all([
    getClientPickupActivity(claims, locationId),
    getClientSentVsReceived(claims, locationId),
    getClientVolumeByQuarter(claims, locationId),
    getClientEsgSummary(claims, locationId),
  ])

  // Fetch location list for client-global drill-down
  const locations = isGlobal ? await getClientLocations(claims) : []

  // Determine subtitle context
  const tenantName = session.user.name ?? 'your organisation'

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {isGlobal
            ? `Cross-market overview for ${tenantName}`
            : locationId
              ? `Overview for ${locations.find((l) => l.id === locationId)?.name ?? 'your location'}`
              : 'Overview for your location'}
        </p>
      </header>

      {/* Client-global: market drill-down pill badges */}
      {isGlobal && locations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-mono text-muted-foreground uppercase tracking-wide">
            Markets:
          </span>
          {/* All markets link */}
          <Link
            href="/overview"
            className={`rounded-full px-3 py-1 font-mono text-[12px] ring-1 ring-inset transition-colors ${
              !searchParams.location
                ? 'bg-foreground text-background ring-foreground'
                : 'bg-background text-muted-foreground ring-border hover:text-foreground'
            }`}
          >
            All
          </Link>
          {locations.map((loc) => (
            <Link
              key={loc.id}
              href={`/overview?location=${loc.id}`}
              className={`rounded-full px-3 py-1 font-mono text-[12px] ring-1 ring-inset transition-colors ${
                searchParams.location === loc.id
                  ? 'bg-foreground text-background ring-foreground'
                  : 'bg-background text-muted-foreground ring-border hover:text-foreground'
              }`}
            >
              {loc.name}
            </Link>
          ))}
        </div>
      )}

      {/* Pickup Activity */}
      <PickupActivityCard
        active={pickupActivity.active}
        recent={pickupActivity.recent}
      />

      {/* Sent vs Received Discrepancy */}
      <DiscrepancyFlag data={sentVsReceived} isGlobal={isGlobal && !searchParams.location} />

      {/* Volume by Quarter + ESG Summary */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <VolumeByQuarterTable
          data={volumeByQuarter}
          isGlobal={isGlobal && !searchParams.location}
        />
        <EsgSummaryWidget
          materials={esgSummary.materials}
          reuseRate={esgSummary.reuseRate}
          totalItems={esgSummary.totalItems}
        />
      </div>
    </div>
  )
}
