import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface PickupConfirmationEmailProps {
  reference: string
  preferredDate: string
  palletCount: number
  locationName: string
}

export default function PickupConfirmationEmail({
  reference,
  preferredDate,
  palletCount,
  locationName,
}: PickupConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your pickup request {reference} has been submitted successfully.</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f6f6f6' }}>
        <Container style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 20px' }}>
          <Heading style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            Pickup Request Confirmed
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Your pickup request <strong>{reference}</strong> has been submitted successfully.
          </Text>

          <Section style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '4px', marginTop: '24px' }}>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Reference:</strong> {reference}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Location:</strong> {locationName}
            </Text>
            <Text style={{ margin: '0 0 8px', fontSize: '14px', color: '#666' }}>
              <strong>Preferred Date:</strong> {preferredDate}
            </Text>
            <Text style={{ margin: '0', fontSize: '14px', color: '#666' }}>
              <strong>Pallets:</strong> {palletCount}
            </Text>
          </Section>

          <Text style={{ fontSize: '14px', color: '#666', marginTop: '24px' }}>
            You will receive updates as your pickup progresses.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
