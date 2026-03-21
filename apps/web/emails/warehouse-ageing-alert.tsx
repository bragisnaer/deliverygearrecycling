import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface WarehouseAgeingAlertEmailProps {
  providerName: string
  warehouseAddress: string
  palletCount: number
  oldestDays: number
  thresholdDays: number
}

export default function WarehouseAgeingAlertEmail({
  providerName,
  warehouseAddress,
  palletCount,
  oldestDays,
  thresholdDays,
}: WarehouseAgeingAlertEmailProps) {
  const platformUrl = process.env.NEXT_PUBLIC_APP_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}/transport/outbound`
    : `/transport/outbound`

  return (
    <Html>
      <Head />
      <Preview>{`${palletCount} pallets at ${providerName} — oldest: ${oldestDays} days`}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            Warehouse Ageing Alert
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <strong>{palletCount} pallets</strong> at <strong>{providerName}</strong> (
            {warehouseAddress}) have exceeded the <strong>{thresholdDays}-day</strong> ageing
            threshold. The oldest pallet has been held for{' '}
            <strong>{oldestDays} days</strong>.
          </Text>

          <Section style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '4px', marginTop: '24px' }}>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Provider:</strong> {providerName}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Warehouse:</strong> {warehouseAddress}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Pallets Over Threshold:</strong> {palletCount}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Oldest:</strong> {oldestDays} days
            </Text>
            <Text style={{ margin: '0', fontSize: '14px', color: '#666' }}>
              <strong>Threshold:</strong> {thresholdDays} days
            </Text>
          </Section>

          <Section style={{ marginTop: '24px' }}>
            <Link
              href={platformUrl}
              style={{
                backgroundColor: '#000000',
                color: '#ffffff',
                padding: '12px 24px',
                borderRadius: '4px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'inline-block',
              }}
            >
              View warehouse inventory
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
