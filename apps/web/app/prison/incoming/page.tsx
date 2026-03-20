import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { getExpectedDeliveries } from '../actions'
import type { DeliveryGroup, ExpectedDelivery } from '../actions'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

// --- Sub-components ---

function DirectDeliveryCard({ delivery }: { delivery: ExpectedDelivery }) {
  const productSummary = delivery.lines
    .map((l) => `${l.product_name} ×${l.quantity}`)
    .join(', ')

  return (
    <Link
      href={`/prison/intake/${delivery.pickup_id}`}
      className="block min-h-16 transition-opacity hover:opacity-90 active:opacity-80"
    >
      <Card className="h-full min-h-16">
        <CardHeader>
          <CardTitle className="font-bold">{delivery.client_name}</CardTitle>
          <CardDescription>{delivery.origin_market}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <p className="font-mono text-sm text-muted-foreground">
            {delivery.reference}
          </p>
          <p className="text-sm text-muted-foreground">{delivery.expected_date}</p>
          {productSummary && (
            <p className="text-sm">{productSummary}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function ConsolidatedShipmentCard({
  group,
}: {
  group: Extract<DeliveryGroup, { type: 'consolidated' }>
}) {
  return (
    <details className="group overflow-hidden rounded-xl ring-1 ring-foreground/10">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between bg-card px-4 py-3 transition-opacity hover:opacity-90 active:opacity-80">
        <div>
          <p className="font-heading text-base font-medium">
            {group.outbound_shipment_reference}
          </p>
          <p className="font-mono text-sm text-muted-foreground">
            {group.deliveries.length} leveringer
          </p>
        </div>
        {/* Chevron indicator */}
        <span className="text-muted-foreground transition-transform group-open:rotate-180">
          &#9660;
        </span>
      </summary>
      <ul className="divide-y divide-border bg-card">
        {group.deliveries.map((delivery) => (
          <li key={delivery.pickup_id}>
            <Link
              href={`/prison/intake/${delivery.pickup_id}`}
              className="flex min-h-16 flex-col justify-center gap-0.5 px-4 py-3 transition-opacity hover:opacity-90 active:opacity-80"
            >
              <span className="font-medium">{delivery.client_name}</span>
              <span className="text-sm text-muted-foreground">
                {delivery.origin_market}
              </span>
              <span className="font-mono text-sm text-muted-foreground">
                {delivery.reference}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}

// --- Page ---

export default async function IncomingDeliveriesPage() {
  const t = await getTranslations('intake')
  const groups = await getExpectedDeliveries()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-xl font-semibold">
        {t('home.deliveries_tab')}
      </h1>

      {groups.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t('home.no_deliveries')}</p>
          <Link
            href="/prison/intake/new"
            className="inline-flex min-h-[48px] items-center justify-center rounded-md border-2 border-foreground bg-background px-6 py-3 font-mono text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80"
          >
            {t('form.register_unexpected')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.map((group) => {
            if (group.type === 'direct') {
              return (
                <DirectDeliveryCard
                  key={group.delivery.pickup_id}
                  delivery={group.delivery}
                />
              )
            }
            return (
              <ConsolidatedShipmentCard
                key={group.outbound_shipment_id}
                group={group}
              />
            )
          })}
        </div>
      )}

      {/* Always-visible secondary action for unexpected deliveries */}
      {groups.length > 0 && (
        <div className="pt-2">
          <Link
            href="/prison/intake/new"
            className="inline-flex min-h-[48px] items-center justify-center rounded-md border-2 border-foreground bg-background px-6 py-3 font-mono text-sm font-medium transition-opacity hover:opacity-90 active:opacity-80"
          >
            {t('form.register_unexpected')}
          </Link>
        </div>
      )}
    </div>
  )
}
