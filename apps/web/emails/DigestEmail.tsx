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
} from "@react-email/components";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DigestEntry {
  screenname: string;
  message: string;
  setAt: string; // pre-formatted local time string, e.g. "9:14 AM"
}

interface DigestEmailProps {
  recipientScreenname: string;
  entries: DigestEntry[]; // away messages from buddies in the last 24h
  unsubscribeUrl: string;
  date: string; // e.g. "Friday, March 27"
}

// ---------------------------------------------------------------------------
// Styles — AIM retro aesthetic: dark bg, amber accents
// ---------------------------------------------------------------------------

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
    margin: "0 0 20px 0",
  } as React.CSSProperties,

  entryWrap: {
    borderLeft: `2px solid ${palette.border}`,
    paddingLeft: "12px",
    marginBottom: "16px",
  } as React.CSSProperties,

  screenname: {
    fontSize: "13px",
    fontWeight: "700",
    color: palette.amber,
    margin: "0 0 2px 0",
  } as React.CSSProperties,

  message: {
    fontSize: "13px",
    color: palette.text,
    margin: "0 0 4px 0",
    lineHeight: "1.5",
  } as React.CSSProperties,

  timestamp: {
    fontSize: "11px",
    color: palette.muted,
    margin: "0",
  } as React.CSSProperties,

  emptyText: {
    fontSize: "13px",
    color: palette.muted,
    fontStyle: "italic",
    margin: "0 0 24px 0",
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

  unsubscribeLink: {
    color: palette.muted,
    textDecoration: "underline",
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DigestEmail({
  recipientScreenname,
  entries,
  unsubscribeUrl,
  date,
}: DigestEmailProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{`Away messages from your buddies — ${date}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header */}
          <Section style={styles.header}>
            <Text style={styles.logo}>SIGNOFF.CHAT</Text>
            <Text style={styles.subheader}>Daily Digest — {date}</Text>
          </Section>

          {/* Greeting */}
          <Text style={styles.greeting}>
            Hey {recipientScreenname}, here&apos;s what your buddies have been up to:
          </Text>

          {/* Away message entries */}
          {entries.length > 0 ? (
            entries.map((entry, i) => (
              <Section key={i} style={styles.entryWrap}>
                <Text style={styles.screenname}>{entry.screenname}</Text>
                <Text style={styles.message}>{entry.message}</Text>
                <Text style={styles.timestamp}>set at {entry.setAt}</Text>
              </Section>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No away messages from your buddies in the last 24 hours.
            </Text>
          )}

          {/* Divider */}
          <Hr style={styles.divider} />

          {/* Footer */}
          <Text style={styles.footer}>
            Signoff Chat, 123 Main St, Anytown, USA
            <br />
            You&apos;re receiving this because you enabled daily digest emails.
            <br />
            <Link href={unsubscribeUrl} style={styles.unsubscribeLink}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
