import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import { db, tenants } from '@repo/db'
import { IMPORT_SOURCES } from '@/lib/import-sources'

export const dynamic = 'force-dynamic'

// Source card emoji indicators
const SOURCE_ICONS: Record<string, string> = {
  pickup_log: '📦',
  intake_log: '🏭',
  greenloop: '♻️',
  invoice_binder: '🧾',
  transport_costs: '🚛',
}

export default async function ImportHubPage() {
  const session = await auth()
  if (session?.user?.role !== 'reco-admin') {
    redirect('/access-denied')
  }

  const tenantRows = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Historical Data Import
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Import historical operational data from CSV or XLSX files.{' '}
          {tenantRows.length > 0 && (
            <span>
              {tenantRows.length} tenant{tenantRows.length > 1 ? 's' : ''} available.
            </span>
          )}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(IMPORT_SOURCES).map((source) => (
          <Link
            key={source.id}
            href={`/import/${source.id}`}
            className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-3 flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                {SOURCE_ICONS[source.id] ?? '📄'}
              </span>
              <div>
                <h2 className="font-heading text-[15px] font-semibold">
                  {source.name}
                </h2>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {source.targetTable}
                </p>
              </div>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">
              {source.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {source.dateRange}
              </span>
              {source.hasLines && (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-600">
                  has line items
                </span>
              )}
            </div>
            <div className="mt-4">
              <span className="font-mono text-[13px] font-semibold text-foreground underline underline-offset-4">
                Start Import &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
