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

interface DiscrepancyAlertEmailProps {
  intakeReference: string
  facilityName: string
  clientName: string
  discrepancyPercent: number
  intakeId: string
}

export default function DiscrepancyAlertEmail({
  intakeReference,
  facilityName,
  clientName,
  discrepancyPercent,
  intakeId,
}: DiscrepancyAlertEmailProps) {
  const platformUrl = process.env.NEXT_PUBLIC_APP_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}/intake/${intakeId}`
    : `/intake/${intakeId}`

  return (
    <Html>
      <Head />
      <Preview>{`Discrepancy detected: ${intakeReference} — ${discrepancyPercent}% variance`}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            Discrepancy Alert
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Intake <strong>{intakeReference}</strong> at <strong>{facilityName}</strong> for{' '}
            <strong>{clientName}</strong> has a discrepancy of{' '}
            <strong>{discrepancyPercent}%</strong> — exceeding the configured threshold.
          </Text>

          <Section style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '4px', marginTop: '24px' }}>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Reference:</strong> {intakeReference}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Facility:</strong> {facilityName}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Client:</strong> {clientName}
            </Text>
            <Text style={{ margin: '0', fontSize: '14px', color: '#666' }}>
              <strong>Discrepancy:</strong> {discrepancyPercent}%
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
              View in platform
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
