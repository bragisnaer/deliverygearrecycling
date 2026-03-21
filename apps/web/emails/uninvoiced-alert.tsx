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

interface UninvoicedAlertEmailProps {
  deliveryCount: number
  oldestDays: number
  estimatedRevenue: string
}

export default function UninvoicedAlertEmail({
  deliveryCount,
  oldestDays,
  estimatedRevenue,
}: UninvoicedAlertEmailProps) {
  const platformUrl = process.env.NEXT_PUBLIC_APP_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}/financial`
    : `/financial`

  return (
    <Html>
      <Head />
      <Preview>{`${deliveryCount} uninvoiced deliveries — oldest: ${oldestDays} days`}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            Uninvoiced Delivery Alert
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <strong>{deliveryCount}</strong> deliveries remain uninvoiced. The oldest is{' '}
            <strong>{oldestDays} days</strong> past delivery.
          </Text>

          <Section style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '4px', marginTop: '24px' }}>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Uninvoiced Count:</strong> {deliveryCount}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Oldest Delivery Age:</strong> {oldestDays} days
            </Text>
            <Text style={{ margin: '0', fontSize: '14px', color: '#666' }}>
              <strong>Estimated Revenue:</strong> {estimatedRevenue}
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
              View financial records
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
