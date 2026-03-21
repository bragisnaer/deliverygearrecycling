import { auth } from '@/auth'
import { db, importJobs, prisonFacilities, products, locations, intakeRecords, pickups, transportProviders } from '@repo/db'
import { eq } from 'drizzle-orm'
import { parseFile } from '@/lib/import-parser'
import {
  applyColumnMapping,
  resolveForeignKeys,
  validateRows,
  getSchemaForSource,
} from '@/lib/import-validators'
import type { FKLookups } from '@/lib/import-validators'
import { IMPORT_SOURCES, type ImportSourceId } from '@/lib/import-sources'

export async function POST(request: Request) {
  const session = await auth()
  if (session?.user?.role !== 'reco-admin') {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const source = formData.get('source') as string | null
  const tenantId = formData.get('tenantId') as string | null
  const columnMapping = formData.get('columnMapping') as string | null

  if (!file || !source || !tenantId) {
    return Response.json(
      { error: 'Missing required fields: file, source, tenantId' },
      { status: 400 }
    )
  }

  // Validate source is a valid ImportSourceId
  if (!IMPORT_SOURCES[source as ImportSourceId]) {
    return Response.json({ error: `Invalid source: ${source}` }, { status: 400 })
  }

  const sourceId = source as ImportSourceId

  // Parse file
  const buffer = Buffer.from(await file.arrayBuffer())
  const { headers, rows } = await parseFile(buffer, file.name)

  // Apply column mapping if provided
  const mappedRows =
    columnMapping && columnMapping.trim().length > 0
      ? applyColumnMapping(rows, JSON.parse(columnMapping))
      : rows

  // Build FK lookups (raw db, no RLS — reco-admin context)
  const lookups: FKLookups = {}

  // Always query facilities and products and locations
  const facilitiesRows = await db
    .select({ id: prisonFacilities.id, name: prisonFacilities.name })
    .from(prisonFacilities)
  lookups.facilities = Object.fromEntries(facilitiesRows.map((f) => [f.name, f.id]))

  const productsRows = await db
    .select({ id: products.id, name: products.name })
    .from(products)
    .where(eq(products.tenant_id, tenantId))
  lookups.products = Object.fromEntries(productsRows.map((p) => [p.name, p.id]))

  const locationsRows = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.tenant_id, tenantId))
  lookups.locations = Object.fromEntries(locationsRows.map((l) => [l.name, l.id]))

  // Conditional lookups by source
  if (sourceId === 'invoice_binder') {
    const intakeRows = await db
      .select({ id: intakeRecords.id, reference: intakeRecords.reference })
      .from(intakeRecords)
    lookups.intakeReferences = Object.fromEntries(
      intakeRows.map((r) => [r.reference, r.id])
    )
  }

  if (sourceId === 'transport_costs') {
    const pickupRows = await db
      .select({ id: pickups.id, reference: pickups.reference })
      .from(pickups)
    lookups.pickupReferences = Object.fromEntries(
      pickupRows.map((p) => [p.reference, p.id])
    )

    const providerRows = await db
      .select({ id: transportProviders.id, name: transportProviders.name })
      .from(transportProviders)
    lookups.providers = Object.fromEntries(
      providerRows.map((p) => [p.name, p.id])
    )
  }

  // Resolve FKs
  const { resolved, errors: fkErrors } = resolveForeignKeys(mappedRows, lookups)

  // Validate resolved rows (cast schema to ZodSchema<unknown> to satisfy union type)
  const schema = getSchemaForSource(sourceId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { valid, errors: validationErrors } = validateRows(resolved, schema as any)

  // Combine errors sorted by row number
  const allErrors = [...fkErrors, ...validationErrors].sort((a, b) => a.row - b.row)

  // Insert import_jobs record
  const [job] = await db
    .insert(importJobs)
    .values({
      source: sourceId,
      target_tenant_id: tenantId,
      status: allErrors.length > 0 ? 'has_errors' : 'ready',
      file_name: file.name,
      total_rows: rows.length,
      valid_rows: valid.length,
      error_count: allErrors.length,
      rows_json: JSON.stringify(valid),
      errors_json: JSON.stringify(allErrors),
      column_mapping_json: columnMapping && columnMapping.trim().length > 0 ? columnMapping : null,
      created_by: session.user.id,
    })
    .returning()

  return Response.json({
    jobId: job.id,
    totalRows: rows.length,
    validRows: valid.length,
    errorCount: allErrors.length,
    errors: allErrors,
    headers,
  })
}
