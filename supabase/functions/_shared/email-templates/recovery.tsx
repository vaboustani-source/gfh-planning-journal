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

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your Gilbertsville Farmhouse portal password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandHeader}>
          <Text style={brandMark}>Gilbertsville Farmhouse</Text>
          <Text style={brandTagline}>Wedding Planning Portal</Text>
        </Section>

        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password. Click the button below to
          choose a new one.
        </Text>

        <Section style={buttonWrap}>
          <Button style={button} href={confirmationUrl}>
            Reset Password
          </Button>
        </Section>

        <Text style={footer}>
          If you didn't request this, you can safely ignore this email — your
          password won't change.
        </Text>
        <Text style={footerBrand}>Gilbertsville Farmhouse · Gilbertsville, NY</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const brandHeader = {
  borderBottom: '1px solid #e8e3d8',
  paddingBottom: '20px',
  marginBottom: '32px',
  textAlign: 'center' as const,
}
const brandMark = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '22px',
  fontWeight: 400,
  color: '#2d3a2e',
  letterSpacing: '0.04em',
  margin: '0 0 4px',
}
const brandTagline = {
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.18em',
  color: '#8a8576',
  margin: 0,
}
const h1 = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '30px',
  fontWeight: 300,
  color: '#2d3a2e',
  margin: '0 0 20px',
}
const text = {
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: '15px',
  color: '#3a3a36',
  lineHeight: '1.6',
  margin: '0 0 18px',
}
const buttonWrap = { margin: '32px 0', textAlign: 'center' as const }
const button = {
  backgroundColor: '#7a8b6f',
  color: '#ffffff',
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: '14px',
  fontWeight: 500,
  letterSpacing: '0.05em',
  borderRadius: '4px',
  padding: '14px 28px',
  textDecoration: 'none',
  textTransform: 'uppercase' as const,
}
const footer = {
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontSize: '12px',
  color: '#8a8576',
  margin: '32px 0 8px',
  paddingTop: '20px',
  borderTop: '1px solid #e8e3d8',
}
const footerBrand = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '12px',
  color: '#8a8576',
  margin: 0,
  fontStyle: 'italic' as const,
}
