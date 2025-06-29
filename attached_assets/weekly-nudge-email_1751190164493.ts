import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
  Font,
} from '@react-email/components';

interface WeeklyNudgeProps {
  managerName: string;
  personalStrength: string;
  personalTip: string;
  specificAction: string;
  teamMemberName: string;
  teamMemberStrength: string;
  teamTip: string;
  weekNumber: number;
  dashboardUrl?: string;
  unsubscribeUrl?: string;
}

export const WeeklyNudgeEmail = ({
  managerName,
  personalStrength,
  personalTip,
  specificAction,
  teamMemberName,
  teamMemberStrength,
  teamTip,
  weekNumber,
  dashboardUrl = 'https://yourapp.replit.app/dashboard',
  unsubscribeUrl = 'https://yourapp.replit.app/settings/unsubscribe',
}: WeeklyNudgeProps) => {
  const previewText = `${managerName}, leverage your ${personalStrength} strength this week`;

  return (
    <Html>
      <Head>
        <Font
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Minimal Header */}
          <Section style={header}>
            <Text style={weekLabel}>Week {weekNumber}: Your {personalStrength} strength spotlight</Text>
          </Section>

          {/* Primary Card - Personal Insight */}
          <Section style={primarySection}>
            <div style={primaryCard}>
              <div style={strengthBadge}>{personalStrength.toUpperCase()}</div>
              <Text style={primaryTip}>{personalTip}</Text>
              <div style={divider}></div>
              <Text style={actionPrompt}>
                <span style={tryThis}>This week, try:</span> {specificAction}
              </Text>
            </div>
          </Section>

          {/* Secondary - Team Quick Tip */}
          <Section style={secondarySection}>
            <div style={miniCard}>
              <Text style={miniCardLabel}>Team insight</Text>
              <Text style={miniCardText}>
                <strong>{teamMemberName}</strong>'s {teamMemberStrength}: {teamTip}
              </Text>
            </div>
          </Section>

          {/* CTA Buttons */}
          <Section style={ctaSection}>
            <Button style={primaryButton} href={dashboardUrl}>
              View Dashboard →
            </Button>
            <Text style={unsubscribeText}>
              <Link href={unsubscribeUrl} style={unsubscribeLink}>
                Unsubscribe
              </Link>
            </Text>
          </Section>

          {/* Minimal Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              Tiny Strength Manager
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles - Cleaner, more focused
const main = {
  backgroundColor: '#F5F0E8',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '32px 20px',
  maxWidth: '520px',
};

const header = {
  marginBottom: '24px',
};

const weekLabel = {
  color: '#003566',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0',
  textAlign: 'center' as const,
};

const primarySection = {
  marginBottom: '20px',
};

const primaryCard = {
  backgroundColor: '#FFFFFF',
  borderRadius: '16px',
  padding: '32px 28px',
  border: '1px solid rgba(0, 0, 0, 0.06)',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
  position: 'relative' as const,
  overflow: 'hidden' as const,
};

const strengthBadge = {
  backgroundColor: '#FFD60A',
  color: '#1A1A1A',
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '1px',
  padding: '6px 12px',
  borderRadius: '20px',
  display: 'inline-block',
  marginBottom: '16px',
};

const primaryTip = {
  color: '#1A1A1A',
  fontSize: '17px',
  lineHeight: '1.6',
  margin: '0 0 20px 0',
  fontWeight: '400',
};

const divider = {
  height: '1px',
  backgroundColor: '#E5E7EB',
  margin: '20px 0',
};

const actionPrompt = {
  color: '#4A4A4A',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0',
};

const tryThis = {
  color: '#003566',
  fontWeight: '600',
};

const secondarySection = {
  marginBottom: '32px',
};

const miniCard = {
  backgroundColor: '#FFFFFF',
  borderRadius: '12px',
  padding: '16px 20px',
  border: '1px solid rgba(0, 0, 0, 0.06)',
};

const miniCardLabel = {
  color: '#003566',
  fontSize: '12px',
  fontWeight: '700',
  letterSpacing: '0.5px',
  marginBottom: '8px',
  textTransform: 'uppercase' as const,
};

const miniCardText = {
  color: '#1A1A1A',
  fontSize: '15px',
  lineHeight: '1.5',
  margin: '0',
};

const question = {
  color: '#003566',
  fontStyle: 'italic',
};

const ctaSection = {
  textAlign: 'center' as const,
  marginBottom: '40px',
};

const primaryButton = {
  backgroundColor: '#1A1A1A',
  borderRadius: '24px',
  color: '#F5F0E8',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
};

const unsubscribeText = {
  marginTop: '16px',
  textAlign: 'center' as const,
};

const unsubscribeLink = {
  color: '#6B7280',
  fontSize: '14px',
  textDecoration: 'underline',
};

const footer = {
  textAlign: 'center' as const,
  paddingTop: '20px',
  borderTop: '1px solid #E5E7EB',
};

const footerText = {
  color: '#9CA3AF',
  fontSize: '13px',
  margin: '0',
  fontWeight: '500',
};

export default WeeklyNudgeEmail;