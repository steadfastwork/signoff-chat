import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Signoff Chat",
};

export default function PrivacyPage() {
  return (
    <article style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text)" }}>
      {/* Header */}
      <p
        style={{
          fontFamily: "var(--font-ibm-plex-mono)",
          fontSize: 11,
          color: "var(--text-dim)",
          marginBottom: 12,
        }}
      >
        Last updated: March 23, 2026
      </p>
      <h1
        style={{
          fontFamily: "var(--font-dm-serif, Georgia, serif)",
          fontSize: "clamp(28px, 5vw, 40px)",
          lineHeight: 1.15,
          color: "var(--text)",
          margin: "0 0 32px",
        }}
      >
        Privacy Policy
      </h1>

      <Lead>
        Short version: we collect the minimum we need to run the service, we don&apos;t sell
        or share it, and you can delete everything at any time.
      </Lead>

      <Divider />

      <H2>What we collect</H2>
      <DataTable
        rows={[
          {
            label: "Email address",
            detail: "Required at registration. Used for account recovery only. Never shown publicly.",
          },
          {
            label: "Screenname",
            detail: "Your public identity on Signoff Chat. Stored in plaintext.",
          },
          {
            label: "Posts & away messages",
            detail:
              "Stored in our database. Public posts are visible to other users per your audience setting.",
          },
          {
            label: "Channel & board messages",
            detail:
              "Stored encrypted. See the Encryption section below — we cannot read these even if compelled.",
          },
          {
            label: "IP address",
            detail:
              "Logged transiently for rate limiting and abuse prevention. Not linked to your account in long-term storage.",
          },
          {
            label: "Payment info",
            detail:
              "Handled entirely by Stripe. We store only a Stripe customer ID and subscription status — never raw card data.",
          },
        ]}
      />

      <Divider />

      <H2>What we don&apos;t collect</H2>
      <BulletList
        items={[
          "No ad-targeting profiles",
          "No tracking pixels or third-party analytics",
          "No sale or rental of your data to anyone, ever",
          "No behavioral fingerprinting",
          "No data brokers",
        ]}
      />

      <Divider />

      <H2>Encryption</H2>
      <P>
        All data is encrypted in transit using TLS. Channel and board messages use{" "}
        <Strong>end-to-end encryption</Strong> (ML-KEM-1024 + AES-256-GCM). Your
        secret key is derived from your account and never sent to our servers.
      </P>
      <P>
        This means: even if a government or court demands the contents of a conversation,
        we cannot provide readable message content. We can confirm that messages exist,
        but we cannot decrypt them.
      </P>

      <Divider />

      <H2>Data retention</H2>
      <P>
        Free accounts retain 90 days of post history. Gold members retain unlimited history.
        You can delete individual posts at any time.
      </P>
      <P>
        <Strong>Delete your account</Strong> and all your data — posts, messages, profile,
        email, everything — is permanently deleted within 30 days. We do not retain
        ghost records or anonymized copies.
      </P>

      <Divider />

      <H2>Cookies</H2>
      <P>
        We use exactly one cookie: the NextAuth session cookie. It is{" "}
        <code
          style={{
            fontFamily: "var(--font-ibm-plex-mono)",
            fontSize: 12,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "1px 6px",
            color: "var(--text)",
          }}
        >
          HttpOnly; SameSite=Lax; Secure
        </code>{" "}
        and contains only your session token. No third-party cookies. No analytics cookies.
        No advertising cookies.
      </P>

      <Divider />

      <H2>Third-party services</H2>
      <DataTable
        rows={[
          {
            label: "Stripe",
            detail:
              "Payment processing for Gold memberships and tips. Subject to Stripe's privacy policy.",
          },
          {
            label: "Pusher",
            detail:
              "Real-time presence and messaging delivery. Message content is encrypted before transmission.",
          },
          {
            label: "UploadThing",
            detail: "Profile image and media storage.",
          },
          {
            label: "Upstash",
            detail: "Redis-backed rate limiting. No personal data stored.",
          },
        ]}
      />

      <Divider />

      <H2>Contact</H2>
      <P>
        Privacy questions:{" "}
        <A href="mailto:privacy@signoffchat.com">privacy@signoffchat.com</A>
      </P>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Prose components
// ---------------------------------------------------------------------------

function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 17,
        color: "var(--text-muted)",
        lineHeight: 1.65,
        marginBottom: 32,
      }}
    >
      {children}
    </p>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-dm-sans)",
        fontWeight: 600,
        fontSize: 18,
        color: "var(--text)",
        margin: "32px 0 14px",
      }}
    >
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 14,
        color: "var(--text-muted)",
        lineHeight: 1.75,
        marginBottom: 14,
      }}
    >
      {children}
    </p>
  );
}

function Strong({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: "var(--text)", fontWeight: 600 }}>{children}</strong>;
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} style={{ color: "var(--amber)", textDecoration: "none" }}>
      {children}
    </a>
  );
}

function Divider() {
  return (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid var(--border)",
        margin: "32px 0",
      }}
    />
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul
      style={{
        margin: "0 0 14px 0",
        padding: "0 0 0 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {items.map((item) => (
        <li
          key={item}
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function DataTable({
  rows,
}: {
  rows: { label: string; detail: string }[];
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      {rows.map((row, i) => (
        <div
          key={row.label}
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr",
            gap: 0,
            borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderRight: "1px solid var(--border)",
              background: "var(--surface)",
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 11,
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {row.label}
          </div>
          <div
            style={{
              padding: "12px 14px",
              background: "var(--card)",
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.6,
            }}
          >
            {row.detail}
          </div>
        </div>
      ))}
    </div>
  );
}
