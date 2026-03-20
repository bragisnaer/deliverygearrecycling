import { notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth-guard'
import { getTraceabilityChain, getEditHistory, voidIntakeRecord } from '../actions'
import { TraceabilityChainView } from '../components/traceability-chain'
import { EditedIndicator, isRecordEdited } from '@/components/edited-indicator'
import { IntakeVoidButton } from '../components/intake-void-button'

interface IntakeDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function IntakeDetailPage({ params }: IntakeDetailPageProps) {
  const auth = await requireAuth(['reco-admin', 'reco'])
  const { id } = await params

  let chain
  try {
    chain = await getTraceabilityChain(id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message === 'Intake record not found') notFound()
    throw err
  }

  // Fetch edit history for the edited indicator
  const editHistory = await getEditHistory('intake_records', id)
  const isEdited = isRecordEdited(editHistory)

  const isRecoAdmin = auth.user.role === 'reco-admin'

  return (
    <div className="max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {chain.intake.reference}
            </h1>
            <EditedIndicator isEdited={isEdited} />
          </div>
          <p className="text-sm text-muted-foreground">
            {chain.intake.staff_name} &middot;{' '}
            {chain.intake.delivery_date.toLocaleDateString('da-DK')}
          </p>
        </div>

        {/* Void button — reco-admin only */}
        {isRecoAdmin && (
          <IntakeVoidButton
            intakeId={id}
            reference={chain.intake.reference}
            voidAction={voidIntakeRecord}
          />
        )}
      </div>

      {/* Traceability chain */}
      <section className="space-y-3">
        <h2 className="text-base font-medium">Sporbarhedskæde</h2>
        <TraceabilityChainView chain={chain} />
      </section>

      {/* Intake details */}
      <section className="space-y-3">
        <h2 className="text-base font-medium">Detaljer</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="font-mono font-medium">{chain.intake.reference}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Medarbejder</dt>
            <dd>{chain.intake.staff_name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Leveringsdato</dt>
            <dd>{chain.intake.delivery_date.toLocaleDateString('da-DK')}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{chain.intake.is_unexpected ? 'Uventet levering' : 'Forventet levering'}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
