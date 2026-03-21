import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { db, tenants, importJobs } from '@repo/db'
import { eq } from 'drizzle-orm'
import { IMPORT_SOURCES, type ImportSourceId } from '@/lib/import-sources'
import { ImportWizard } from './import-wizard'

export const dynamic = 'force-dynamic'

type Params = Promise<{ source: string }>
type SearchParams = Promise<{ jobId?: string }>

export default async function ImportSourcePage(props: {
  params: Params
  searchParams: SearchParams
}) {
  const session = await auth()
  if (session?.user?.role !== 'reco-admin') {
    redirect('/access-denied')
  }

  const params = await props.params
  const searchParams = await props.searchParams

  // Validate source param
  const source = IMPORT_SOURCES[params.source as ImportSourceId]
  if (!source) {
    redirect('/import')
  }

  // Query tenants for tenant selector
  const tenantRows = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)

  // Load existing job if jobId is present
  let existingJob = null
  if (searchParams.jobId) {
    const jobRows = await db
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, searchParams.jobId))
      .limit(1)
    existingJob = jobRows[0] ?? null
  }

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/import" className="hover:text-foreground">
          Import
        </a>
        <span>/</span>
        <span className="text-foreground">{source.name}</span>
      </div>
      <ImportWizard
        source={source}
        tenants={tenantRows}
        existingJob={
          existingJob
            ? {
                id: existingJob.id,
                status: existingJob.status,
                total_rows: existingJob.total_rows,
                valid_rows: existingJob.valid_rows,
                error_count: existingJob.error_count,
                errors_json: existingJob.errors_json,
                column_mapping_json: existingJob.column_mapping_json ?? null,
              }
            : null
        }
      />
    </div>
  )
}
