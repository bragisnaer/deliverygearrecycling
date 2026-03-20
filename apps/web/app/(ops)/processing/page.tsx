import { requireAuth } from '@/lib/auth-guard'
import { getPipelineData } from './actions'
import { STAGE_ORDER, STAGE_LABELS } from '@/lib/pipeline-stage'
// PipelineCard renders EditedIndicator for processing report cards (AUDIT-05)
import { PipelineCard } from './pipeline-card'

export default async function ProcessingPipelinePage() {
  await requireAuth(['reco-admin', 'reco'])

  const pipeline = await getPipelineData()

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="font-heading text-[20px] font-semibold leading-[1.2]">
          Behandlingspipeline
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Oversigt over alle intake-poster fordelt på behandlingstrin.
        </p>
      </div>

      {/* Pipeline stage columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STAGE_ORDER.map((stage) => {
          const items = pipeline[stage]
          return (
            <div key={stage} className="flex flex-col gap-3">
              {/* Column header with badge count */}
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-[13px] font-semibold text-foreground">
                  {STAGE_LABELS[stage]}
                </h2>
                <span className="inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {items.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2">
                {items.length === 0 ? (
                  <p className="py-4 text-center font-mono text-[12px] text-muted-foreground">
                    Ingen poster
                  </p>
                ) : (
                  items.map((item) => (
                    <PipelineCard
                      key={item.id}
                      intakeId={item.id}
                      reference={item.reference}
                      facilityName={item.facility_name}
                      clientName={item.client_name}
                      staffName={item.staff_name}
                      deliveryDate={item.delivery_date}
                      originMarket={item.origin_market}
                      washReport={item.washReport}
                      packReport={item.packReport}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
