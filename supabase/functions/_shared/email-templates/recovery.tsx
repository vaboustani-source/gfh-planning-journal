/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your Gilbertsville Farmhouse Planning Journal password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={wordmark}>Gilbertsville Farmhouse</Text>
          <Text style={tagline}>Planning Journal</Text>
        </Section>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset the password on your Planning Journal account.
          Click below to choose a new one.
        </Text>
        <Section style={{ textAlign: 'center' as const }}>
          <Button style={button} href={confirmationUrl}>
            Reset password
          </Button>
        </Section>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this email —
          your password won't be changed.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const header = { textAlign: 'center' as const, marginBottom: '32px', borderBottom: '1px solid #e8e6df', paddingBottom: '20px' }
const wordmark = { fontSize: '22px', fontWeight: '300' as const, color: '#2d3a2e', letterSpacing: '0.05em', margin: '0' }
const tagline = { fontSize: '14px', fontStyle: 'italic' as const, color: '#7a8478', margin: '4px 0 0' }
const h1 = { fontSize: '26px', fontWeight: '300' as const, color: '#2d3a2e', margin: '0 0 18px', letterSpacing: '0.02em' }
const text = { fontSize: '15px', color: '#55615a', lineHeight: '1.65', margin: '0 0 28px' }
const button = {
  backgroundColor: '#5b6f56',
  color: '#ffffff',
  fontSize: '14px',
  letterSpacing: '0.05em',
  borderRadius: '4px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#9aa097', margin: '36px 0 0', textAlign: 'center' as const }
