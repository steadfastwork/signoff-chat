import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
  Button,
} from "@react-email/components";

interface VerificationEmailProps {
  screenname: string;
  verificationUrl: string;
}

const palette = {
  bg: "#0d0d0b",
  surface: "#111110",
  border: "#2a2620",
  text: "#e8ddd0",
  muted: "#6b6055",
  amber: "#c8860a",
  amberLight: "#e6a020",
};

const styles = {
  body: {
    backgroundColor: palette.bg,
    margin: "0",
    padding: "0",
    fontFamily: "'Courier New', Courier, monospace",
  } as React.CSSProperties,

  container: {
    maxWidth: "580px",
    margin: "0 auto",
    padding: "32px 16px",
  } as React.CSSProperties,

  header: {
    borderBottom: `1px solid ${palette.border}`,
    paddingBottom: "16px",
    marginBottom: "24px",
  } as React.CSSProperties,

  logo: {
    fontSize: "28px",
    fontWeight: "700",
    color: palette.amber,
    letterSpacing: "0.12em",
    margin: "0 0 4px 0",
  } as React.CSSProperties,

  subheader: {
    fontSize: "13px",
    color: palette.muted,
    margin: "0",
    letterSpacing: "0.06em",
  } as React.CSSProperties,

  greeting: {
    fontSize: "13px",
    color: palette.text,
    margin: "0 0 8px 0",
  } as React.CSSProperties,

  body_text: {
    fontSize: "13px",
    color: palette.muted,
    margin: "0 0 24px 0",
    lineHeight: "1.6",
  } as React.CSSProperties,

  button: {
    backgroundColor: palette.amber,
    borderRadius: "8px",
    color: "#fff",
    display: "inline-block",
    fontSize: "14px",
    fontWeight: "700",
    letterSpacing: "0.04em",
    padding: "12px 28px",
    textDecoration: "none",
  } as React.CSSProperties,

  buttonWrap: {
    textAlign: "center" as const,
    margin: "0 0 24px 0",
  } as React.CSSProperties,

  fallback: {
    fontSize: "11px",
    color: palette.muted,
    margin: "16px 0 0 0",
    lineHeight: "1.6",
  } as React.CSSProperties,

  fallbackLink: {
    color: palette.amber,
    wordBreak: "break-all" as const,
  } as React.CSSProperties,

  divider: {
    borderTop: `1px solid ${palette.border}`,
    margin: "24px 0",
  } as React.CSSProperties,

  footer: {
    fontSize: "11px",
    color: palette.muted,
    lineHeight: "1.6",
    margin: "0",
  } as React.CSSProperties,
};

export default function VerificationEmail({
  screenname,
  verificationUrl,
}: VerificationEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Verify your Signoff Chat email address</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.logo}>SIGNOFF.CHAT</Text>
            <Text style={styles.subheader}>Email Verification</Text>
          </Section>

          {/* Body */}
          <Text style={styles.greeting}>Hey {screenname},</Text>
          <Text style={styles.body_text}>
            Click the button below to verify your email address and activate
            your account. This link expires in 24 hours.
          </Text>

          {/* CTA */}
          <Section style={styles.buttonWrap}>
            <Button href={verificationUrl} style={styles.button}>
              Verify my email →
            </Button>
          </Section>

          <Text style={styles.fallback}>
            If the button doesn&apos;t work, paste this link into your browser:
            <br />
            <Link href={verificationUrl} style={styles.fallbackLink}>
              {verificationUrl}
            </Link>
          </Text>

          <Hr style={styles.divider} />

          <Text style={styles.footer}>
            If you didn&apos;t create a Signoff Chat account, you can safely
            ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
