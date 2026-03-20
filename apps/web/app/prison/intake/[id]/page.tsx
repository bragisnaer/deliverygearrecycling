import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { db, systemSettings } from '@repo/db'
import { getExpectedDelivery } from '../../actions'
import { IntakeForm } from '../../components/intake-form'

interface IntakePageProps {
  params: Promise<{ id: string }>
}

export default async function IntakePage({ params }: IntakePageProps) {
  const { id } = await params
  const t = await getTranslations('intake')

  // Fetch pickup data
  const deliveryData = await getExpectedDelivery(id)

  if (!deliveryData) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-xl font-semibold">
          Levering ikke fundet
        </h1>
        <p className="text-sm text-muted-foreground">
          Leveringen med ID <span className="font-mono">{id}</span> blev ikke fundet.
        </p>
        <Link
          href="/prison/incoming"
          className="inline-flex min-h-[48px] items-center justify-center rounded-md border-2 border-foreground bg-background px-6 py-3 font-mono text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80"
        >
          Tilbage til leveringer
        </Link>
      </div>
    )
  }

  // Read discrepancy threshold from system_settings (default 15)
  let threshold = 15
  try {
    const settings = await db.select().from(systemSettings).limit(1)
    if (settings.length > 0 && settings[0]) {
      threshold = settings[0].discrepancy_alert_threshold_pct
    }
  } catch {
    // Non-critical — fall back to default 15
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold">
          {t('home.primary_cta')} — {deliveryData.reference}
        </h1>
        <p className="text-sm text-muted-foreground">
          {deliveryData.client_name} · {deliveryData.origin_market}
        </p>
      </div>

      <IntakeForm pickup={deliveryData} threshold={threshold} />
    </div>
  )
}
