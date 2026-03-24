import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moderation Policy — Signoff Chat",
};

export default function ModerationPolicyPage() {
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
        Moderation Policy
      </h1>

      <Lead>
        We remove only three things, and only when legally required. Everything else stays.
      </Lead>

      <Divider />

      {/* The three */}
      <H2>What we remove</H2>

      <NumberedItem n={1} label="Child sexual abuse material (CSAM)">
        Immediately removed and reported to the National Center for Missing &amp; Exploited
        Children (NCMEC) as required under federal law (18 U.S.C. § 2258A). No discretion
        exercised — this is a legal obligation we enforce without exception.
      </NumberedItem>

      <NumberedItem n={2} label="Credible, specific threats of violence">
        To qualify, a threat must name a{" "}
        <Strong>specific person, specific place, and specific method.</Strong> All three.
        <br />
        <br />
        What does <em>not</em> qualify:
        <BulletList
          items={[
            "General anger or expressions of frustration",
            "Offensive, edgy, or provocative speech",
            'Hyperbolic language ("I could kill for a coffee")',
            "Content we personally find distasteful",
            "Political speech, satire, or dark humor",
          ]}
        />
      </NumberedItem>

      <NumberedItem n={3} label="Valid court orders">
        We comply with lawful court orders from courts of competent jurisdiction. We will
        notify affected users when legally permitted to do so.
      </NumberedItem>

      <Divider />

      {/* What we don't do */}
      <H2>What we do not moderate</H2>
      <P>
        We do not remove content because it is offensive, unpopular, politically
        inconvenient, morally objectionable, or something we personally disagree with.
        We do not shadowban. We do not throttle reach. We do not apply secret strikes.
      </P>
      <P>
        If your content is visible to you, it is visible to others. Full stop.
      </P>

      <Divider />

      {/* Channel / Board operators */}
      <H2>Channels and boards</H2>
      <P>
        Channel creators and Board founders may set their own community norms and remove
        content from their specific space. This is a community management tool, not a
        platform-level moderation power.
      </P>
      <P>
        Operators <Strong>cannot</Strong> suspend or penalize accounts at the platform
        level. A ban from a channel or board affects only that space — the user retains
        their account and can participate elsewhere on Signoff Chat.
      </P>

      <Divider />

      {/* Reporting */}
      <H2>How to report</H2>
      <P>
        Email <A href="mailto:abuse@signoffchat.com">abuse@signoffchat.com</A> with a
        link to the content and a brief description of why you believe it meets one of
        the three removal criteria above.
      </P>
      <BulletList
        items={[
          "All reports are logged with a timestamp",
          "We respond within 72 hours",
          "Reports that do not meet the criteria will receive a brief explanation",
        ]}
      />

      <Divider />

      {/* Transparency */}
      <H2>Transparency</H2>
      <P>
        We publish an annual transparency report covering the number of removal
        requests received, the number complied with, and the categories involved.
        We do not publish specifics that could identify reporters or subjects of
        pending legal matters.
      </P>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Shared prose components
// ---------------------------------------------------------------------------

function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 17,
        color: "var(--text-muted)",
        lineHeight: 1.65,
        marginBottom: 32,
        fontFamily: "var(--font-dm-sans)",
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
    <a
      href={href}
      style={{ color: "var(--amber)", textDecoration: "none" }}
    >
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
        margin: "12px 0 0 0",
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

function NumberedItem({
  n,
  label,
  children,
}: {
  n: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        marginBottom: 24,
      }}
    >
      {/* Number */}
      <div
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--amber-tint)",
          border: "1px solid rgba(200,134,10,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-ibm-plex-mono)",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--amber)",
          marginTop: 1,
        }}
      >
        {n}
      </div>
      {/* Content */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontWeight: 600,
            fontSize: 15,
            color: "var(--text)",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            lineHeight: 1.75,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
