import { getTranslations } from 'next-intl/server'
import { db, systemSettings } from '@repo/db'
import { getClientsForIntake } from '../../actions'
import { UnexpectedIntakeForm } from '../../components/unexpected-intake-form'

export default async function UnexpectedIntakePage() {
  const t = await getTranslations('intake')

  // Fetch all active clients for the dropdown
  const clients = await getClientsForIntake()

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
          {t('form.unexpected_delivery')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('form.register_unexpected')}
        </p>
      </div>

      <UnexpectedIntakeForm clients={clients} threshold={threshold} />
    </div>
  )
}
