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

interface PickupConfirmedEmailProps {
  reference: string
  clientName: string
  locationName: string
  confirmedDate: string
  pickupId: string
}

export default function PickupConfirmedEmail({
  reference,
  clientName,
  locationName,
  confirmedDate,
  pickupId,
}: PickupConfirmedEmailProps) {
  const platformUrl = process.env.NEXT_PUBLIC_APP_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_APP_DOMAIN}/pickups/${pickupId}`
    : `/pickups/${pickupId}`

  return (
    <Html>
      <Head />
      <Preview>{`Pickup ${reference} confirmed for ${confirmedDate}`}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            Pickup Confirmed
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Your pickup request <strong>{reference}</strong> has been confirmed.
          </Text>

          <Section style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '4px', marginTop: '24px' }}>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Reference:</strong> {reference}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Client:</strong> {clientName}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Location:</strong> {locationName}
            </Text>
            <Text style={{ margin: '0', fontSize: '14px', color: '#666' }}>
              <strong>Confirmed Date:</strong> {confirmedDate}
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
              View pickup
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
