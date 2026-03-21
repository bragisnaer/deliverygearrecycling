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

interface FacilityInactiveAlertEmailProps {
  facilityName: string
  lastIntakeDate: string
  daysSinceLastIntake: number
}

export default function FacilityInactiveAlertEmail({
  facilityName,
  lastIntakeDate,
  daysSinceLastIntake,
}: FacilityInactiveAlertEmailProps) {
  const platformUrl = process.env.NEXT_PUBLIC_APP_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}/settings`
    : `/settings`

  return (
    <Html>
      <Head />
      <Preview>{`${facilityName} inactive — no intake for ${daysSinceLastIntake} days`}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            Facility Inactive Alert
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            <strong>{facilityName}</strong> has not registered any intake for{' '}
            <strong>{daysSinceLastIntake} days</strong> (last intake: {lastIntakeDate}).
          </Text>

          <Section style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '4px', marginTop: '24px' }}>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Facility:</strong> {facilityName}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Last Intake Date:</strong> {lastIntakeDate}
            </Text>
            <Text style={{ margin: '0', fontSize: '14px', color: '#666' }}>
              <strong>Days Inactive:</strong> {daysSinceLastIntake}
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
              View settings
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
