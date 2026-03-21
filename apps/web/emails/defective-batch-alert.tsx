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

interface DefectiveBatchAlertEmailProps {
  intakeReference: string
  facilityName: string
  batchNumber: string
  flagReason: string
  intakeId: string
}

export default function DefectiveBatchAlertEmail({
  intakeReference,
  facilityName,
  batchNumber,
  flagReason,
  intakeId,
}: DefectiveBatchAlertEmailProps) {
  const platformUrl = process.env.NEXT_PUBLIC_APP_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}/intake/${intakeId}`
    : `/intake/${intakeId}`

  return (
    <Html>
      <Head />
      <Preview>Defective batch match: {batchNumber} at {facilityName}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            Defective Batch Match
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Batch <strong>{batchNumber}</strong> entered during intake{' '}
            <strong>{intakeReference}</strong> at <strong>{facilityName}</strong> matches a flagged
            batch entry.
          </Text>

          <Section style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '4px', marginTop: '24px' }}>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Reference:</strong> {intakeReference}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Facility:</strong> {facilityName}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Batch Number:</strong> {batchNumber}
            </Text>
            <Text style={{ margin: '0', fontSize: '14px', color: '#666' }}>
              <strong>Flag Reason:</strong> {flagReason}
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
