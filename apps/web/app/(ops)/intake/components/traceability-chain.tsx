'use client'

import { type TraceabilityChain, type DispatchLink } from '@/lib/traceability'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, ArrowDown } from 'lucide-react'

interface TraceabilityChainViewProps {
  chain: TraceabilityChain
}

// --- Stage card ---

interface StageCardProps {
  title: string
  content: React.ReactNode
  available: boolean
  highlight?: boolean
}

function StageCard({ title, content, available, highlight }: StageCardProps) {
  return (
    <div
      className={[
        'flex min-w-[140px] flex-col gap-1 rounded-lg border p-3',
        available ? 'bg-card' : 'border-dashed bg-muted/30',
        highlight ? 'border-primary' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </span>
      {available ? (
        <div className="text-sm">{content}</div>
      ) : (
        <span className="text-xs text-muted-foreground italic">Ikke tilgængelig</span>
      )}
    </div>
  )
}

// --- Dispatch stage ---

function DispatchStage({
  dispatch,
  dispatchFallback,
}: {
  dispatch: DispatchLink | null
  dispatchFallback: DispatchLink[] | null
}) {
  if (dispatch) {
    return (
      <StageCard
        title="Forsendelse"
        available={true}
        content={
          <div className="flex flex-col gap-1">
            <Badge variant="outline" className="w-fit text-xs">
              Direkte kobling
            </Badge>
            <span className="text-xs text-muted-foreground">
              {dispatch.dispatch_date.toLocaleDateString('da-DK')}
            </span>
            <span className="truncate text-xs">{dispatch.destination}</span>
            <StatusBadge status={dispatch.status} />
          </div>
        }
      />
    )
  }

  if (dispatchFallback) {
    return (
      <div className="flex min-w-[140px] flex-col gap-1 rounded-lg border p-3 bg-card">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Forsendelse
        </span>
        <Badge variant="secondary" className="w-fit text-xs">
          Mulige forsendelser ({dispatchFallback.length})
        </Badge>
        <div className="flex flex-col gap-1 mt-1">
          {dispatchFallback.map((d) => (
            <div
              key={d.id}
              className="rounded border border-dashed px-2 py-1 text-xs"
            >
              <span className="block text-muted-foreground">
                {d.dispatch_date.toLocaleDateString('da-DK')}
              </span>
              <span className="block truncate">{d.destination}</span>
              <StatusBadge status={d.status} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return <StageCard title="Forsendelse" available={false} content={null} />
}

// --- Status badge helper ---

function StatusBadge({ status }: { status: string }) {
  const labelMap: Record<string, string> = {
    delivered: 'Leveret',
    picked_up: 'Afhentet',
    created: 'Oprettet',
    in_transit: 'Under transport',
    submitted: 'Indsendt',
    confirmed: 'Bekræftet',
    transport_booked: 'Transport booket',
    at_warehouse: 'På lager',
    in_outbound_shipment: 'I udgående forsendelse',
    intake_registered: 'Modtaget',
    cancelled: 'Annulleret',
  }

  return (
    <Badge variant="outline" className="w-fit text-xs mt-1">
      {labelMap[status] ?? status}
    </Badge>
  )
}

// --- Connector arrows ---

function ConnectorRight() {
  return (
    <div className="hidden md:flex items-center self-center shrink-0 px-1 text-muted-foreground">
      <ArrowRight className="h-4 w-4" />
    </div>
  )
}

function ConnectorDown() {
  return (
    <div className="flex md:hidden items-center justify-center py-1 text-muted-foreground">
      <ArrowDown className="h-4 w-4" />
    </div>
  )
}

// --- Main component ---

/**
 * TraceabilityChainView renders the full 6-stage linked record chain:
 *   Pickup -> Transport -> Intake -> Wash -> Pack -> Dispatch
 *
 * Null stages render as dashed "Ikke tilgængelig" cards.
 * Dispatch handles deterministic (single card) vs fallback (multi-dispatch list).
 *
 * Layout: horizontal flow on desktop (md+), vertical stack on mobile.
 */
export function TraceabilityChainView({ chain }: TraceabilityChainViewProps) {
  const stages = [
    // Stage 1: Pickup
    <StageCard
      key="pickup"
      title="Afhentningsanmodning"
      available={chain.pickup !== null}
      highlight={false}
      content={
        chain.pickup ? (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs">{chain.pickup.reference}</span>
            <StatusBadge status={chain.pickup.status} />
            {chain.intake.is_unexpected && (
              <Badge variant="secondary" className="w-fit text-xs">
                Uventet levering
              </Badge>
            )}
          </div>
        ) : null
      }
    />,

    // Stage 2: Transport
    <StageCard
      key="transport"
      title="Transport"
      available={chain.transport !== null}
      content={
        chain.transport ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs capitalize">{chain.transport.type}</span>
            {chain.transport.provider && (
              <span className="text-xs text-muted-foreground">{chain.transport.provider}</span>
            )}
            <StatusBadge status={chain.transport.status} />
          </div>
        ) : null
      }
    />,

    // Stage 3: Intake (always present — anchor record)
    <StageCard
      key="intake"
      title="Modtagelse"
      available={true}
      highlight={true}
      content={
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs">{chain.intake.reference}</span>
          <span className="text-xs text-muted-foreground">{chain.intake.staff_name}</span>
          <span className="text-xs text-muted-foreground">
            {chain.intake.delivery_date.toLocaleDateString('da-DK')}
          </span>
          {chain.intake.is_unexpected && (
            <Badge variant="secondary" className="w-fit text-xs">
              Uventet levering
            </Badge>
          )}
        </div>
      }
    />,

    // Stage 4: Wash
    <StageCard
      key="wash"
      title="Vask"
      available={chain.wash !== null}
      content={
        chain.wash ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs">{chain.wash.product_name}</span>
            <span className="text-xs text-muted-foreground">{chain.wash.staff_name}</span>
            <span className="text-xs text-muted-foreground">
              {chain.wash.report_date.toLocaleDateString('da-DK')}
            </span>
          </div>
        ) : null
      }
    />,

    // Stage 5: Pack
    <StageCard
      key="pack"
      title="Pakning"
      available={chain.pack !== null}
      content={
        chain.pack ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs">{chain.pack.product_name}</span>
            <span className="text-xs text-muted-foreground">{chain.pack.staff_name}</span>
            <span className="text-xs text-muted-foreground">
              {chain.pack.report_date.toLocaleDateString('da-DK')}
            </span>
          </div>
        ) : null
      }
    />,

    // Stage 6: Dispatch (handles deterministic, fallback, and null cases)
    <DispatchStage
      key="dispatch"
      dispatch={chain.dispatch}
      dispatchFallback={chain.dispatchFallback}
    />,
  ]

  return (
    <div className="w-full">
      {/* Desktop: horizontal flow */}
      <div className="hidden md:flex flex-row flex-wrap items-start gap-0">
        {stages.map((stage, idx) => (
          <div key={idx} className="flex items-start">
            {stage}
            {idx < stages.length - 1 && <ConnectorRight />}
          </div>
        ))}
      </div>

      {/* Mobile: vertical stack */}
      <div className="flex md:hidden flex-col">
        {stages.map((stage, idx) => (
          <div key={idx} className="flex flex-col">
            {stage}
            {idx < stages.length - 1 && <ConnectorDown />}
          </div>
        ))}
      </div>
    </div>
  )
}
