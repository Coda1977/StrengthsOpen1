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

interface WelcomeEmailProps {
  firstName?: string;
  strength1: string;
  strength2: string;
  challengeText: string;
  nextMonday?: string;
  greeting: string;
  dna: string;
  whatsNext: string;
  cta: string;
  unsubscribeUrl?: string;
}

export const WelcomeEmail = ({
  firstName = 'there',
  strength1,
  strength2,
  challengeText,
  nextMonday = 'Monday',
  greeting,
  dna,
  whatsNext,
  cta,
  unsubscribeUrl = '#',
}: WelcomeEmailProps) => (
  <Html>
    <Head>
      <title>Welcome to Strengths Manager</title>
      <style>{`
        body, p { margin: 0; }
        table { border-collapse: collapse; }
        @media only screen and (max-width: 600px) {
          .email-container { width: 100% !important; max-width: 100% !important; }
          .content-padding { padding: 20px !important; }
          .mobile-text { font-size: 16px !important; line-height: 1.5 !important; }
        }
      `}</style>
    </Head>
    <Body style={{ margin: 0, padding: 0, backgroundColor: '#F5F0E8', fontFamily: '-apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif', color: '#0F172A' }}>
      {/* Hidden pre-header */}
      <span style={{ display: 'none', fontSize: 1, color: '#F5F0E8', lineHeight: 1, maxHeight: 0, maxWidth: 0, opacity: 0, overflow: 'hidden' }}>
        Your 12-week strengths journey starts now
      </span>
      <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: '#F5F0E8', minHeight: '100vh' }}>
        <tr>
          <td align="center" style={{ padding: '40px 20px' }}>
            <table className="email-container" width="100%" style={{ maxWidth: 540, backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} cellPadding={0} cellSpacing={0}>
              {/* Header */}
              <tr>
                <td className="content-padding" style={{ padding: '40px 32px 32px 32px', textAlign: 'center' }}>
                  <h1 style={{ color: '#003566', fontSize: 28, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
                    Welcome to Strengths Manager
                  </h1>
                </td>
              </tr>
              {/* Main Content */}
              <tr>
                <td className="content-padding" style={{ padding: '0 32px 40px 32px' }}>
                  {/* Personal Greeting */}
                  <div style={{ marginBottom: 32 }}>
                    <p style={{ fontSize: 18, lineHeight: 1.6, margin: '0 0 16px 0', color: '#0F172A' }}>
                      {greeting}
                    </p>
                  </div>
                  {/* Key Strengths Focus */}
                  <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 24, marginBottom: 32, borderLeft: '4px solid #CC9B00' }}>
                    <h2 style={{ color: '#003566', fontSize: 16, fontWeight: 700, margin: '0 0 16px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Your Leadership DNA
                    </h2>
                    <p style={{ color: '#0F172A', fontSize: 18, fontWeight: 600, margin: '0 0 8px 0', lineHeight: 1.4 }}>
                      {strength1} + {strength2}
                    </p>
                    <p style={{ color: '#4B5563', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                      {dna}
                    </p>
                  </div>
                  {/* Today's Challenge */}
                  <div style={{ background: '#FEF3C7', borderRadius: 8, padding: 20, marginBottom: 32 }}>
                    <h3 style={{ color: '#92400E', fontSize: 15, fontWeight: 700, margin: '0 0 12px 0' }}>
                      Try This Today:
                    </h3>
                    <p style={{ color: '#1F2937', fontSize: 15, lineHeight: 1.5, margin: 0 }}>
                      {challengeText}
                    </p>
                  </div>
                  {/* What's Next */}
                  <div style={{ marginBottom: 32 }}>
                    <h3 style={{ color: '#003566', fontSize: 18, fontWeight: 700, margin: '0 0 16px 0' }}>
                      What happens next?
                    </h3>
                    <p style={{ color: '#374151', fontSize: 15, lineHeight: 1.6, margin: '0 0 16px 0' }}>
                      {whatsNext}
                    </p>
                  </div>
                  {/* Next Step */}
                  <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 20, textAlign: 'center' }}>
                    <p style={{ color: '#003566', fontSize: 16, fontWeight: 600, margin: 0 }}>
                      {cta}
                    </p>
                    <p style={{ color: '#6B7280', fontSize: 14, margin: '8px 0 0 0' }}>
                      Get ready to lead differently.
                    </p>
                  </div>
                </td>
              </tr>
              {/* Footer */}
              <tr>
                <td className="content-padding" style={{ padding: '24px 32px 32px 32px', borderTop: '1px solid #E5E7EB' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 8px 0', fontWeight: 500 }}>
                      Strengths Manager
                    </p>
                    <p style={{ color: '#9CA3AF', fontSize: 13, margin: '0 0 16px 0' }}>
                      AI-powered leadership development
                    </p>
                    {/* CAN-SPAM Compliance */}
                    <p style={{ margin: '16px 0 0 0' }}>
                      <a href={unsubscribeUrl} style={{ color: '#6B7280', fontSize: 12, textDecoration: 'underline' }}>
                        Unsubscribe
                      </a>
                    </p>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </Body>
  </Html>
); 