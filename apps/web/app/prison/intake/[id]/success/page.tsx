import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { db, intakeRecords, intakeLines, products } from '@repo/db'
import { eq } from 'drizzle-orm'
import { AutoRedirect } from './auto-redirect'

interface SuccessPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ intakeId?: string }>
}

export default async function IntakeSuccessPage({
  params,
  searchParams,
}: SuccessPageProps) {
  const { id } = await params
  const { intakeId } = await searchParams
  const t = await getTranslations('intake.success')

  // Fetch the intake record if we have an intakeId
  let record: {
    reference: string
    client_name: string | null
    origin_market: string | null
    lines: { product_name: string | null; actual_quantity: number }[]
  } | null = null

  if (intakeId) {
    try {
      const recordRows = await db
        .select({
          id: intakeRecords.id,
          reference: intakeRecords.reference,
          origin_market: intakeRecords.origin_market,
        })
        .from(intakeRecords)
        .where(eq(intakeRecords.id, intakeId))
        .limit(1)

      if (recordRows.length > 0 && recordRows[0]) {
        const lineRows = await db
          .select({
            product_name: products.name,
            actual_quantity: intakeLines.actual_quantity,
          })
          .from(intakeLines)
          .leftJoin(products, eq(products.id, intakeLines.product_id))
          .where(eq(intakeLines.intake_record_id, intakeId))

        record = {
          reference: recordRows[0].reference,
          client_name: null, // tenant name requires join — not critical for success screen
          origin_market: recordRows[0].origin_market,
          lines: lineRows,
        }
      }
    } catch {
      // Non-critical — show success screen without detail if fetch fails
    }
  }

  // Fallback reference from route context
  const displayReference = record?.reference ?? `IN-${id.slice(0, 8).toUpperCase()}`

  return (
    <div className="flex flex-col gap-8">
      {/* Title */}
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold">
          {t('title')}
        </h1>
        {record?.reference && (
          <p className="font-mono text-sm text-muted-foreground">
            {displayReference}
          </p>
        )}
      </div>

      {/* Summary card */}
      {record && (
        <div className="rounded-xl border border-border bg-card p-4">
          {record.origin_market && (
            <div className="mb-3 flex flex-col gap-0.5">
              <span className="text-sm font-medium text-muted-foreground">
                Marked
              </span>
              <span className="text-base">{record.origin_market}</span>
            </div>
          )}

          {record.lines.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                Optalt
              </span>
              <ul className="flex flex-col gap-1">
                {record.lines.map((line, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>{line.product_name ?? 'Ukendt produkt'}</span>
                    <span className="font-mono font-semibold">
                      ×{line.actual_quantity}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Auto-dismiss countdown */}
      <AutoRedirect destination="/prison" delayMs={10000} />

      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        <Link
          href="/prison/incoming"
          className="inline-flex min-h-[48px] items-center justify-center rounded-md border-2 border-foreground bg-primary px-6 py-3 font-mono text-base text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80"
        >
          {t('register_another')}
        </Link>
        <Link
          href="/prison"
          className="inline-flex min-h-[48px] items-center justify-center rounded-md border-2 border-foreground bg-background px-6 py-3 font-mono text-base transition-opacity hover:opacity-90 active:opacity-80"
        >
          {t('go_home')}
        </Link>
      </div>
    </div>
  )
}
