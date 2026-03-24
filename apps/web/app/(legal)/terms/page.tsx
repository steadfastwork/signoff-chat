import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Signoff Chat",
};

export default function TermsPage() {
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
        Terms of Service
      </h1>

      <Lead>
        Plain language. No legalese traps. These are the rules — ours and yours.
      </Lead>

      <Divider />

      <H2>Your content</H2>
      <P>
        <Strong>You own everything you post.</Strong> We claim no intellectual property
        rights over your posts, messages, images, or any other content you create on
        Signoff Chat.
      </P>
      <P>
        By posting, you grant us a limited license to display and deliver your content
        to other users on the platform. That&apos;s it. We cannot license your content
        to advertisers, sell it, or use it to train AI models.
      </P>

      <Divider />

      <H2>What you agree not to post</H2>
      <P>
        There are only two hard rules:
      </P>
      <NumberedItem n={1} label="No CSAM">
        Do not post child sexual abuse material. Doing so will result in immediate
        account termination and a mandatory report to NCMEC under federal law.
      </NumberedItem>
      <NumberedItem n={2} label="No credible specific threats of violence">
        Do not post threats that name a specific person, place, and method. See our{" "}
        <A href="/moderation-policy">Moderation Policy</A> for the full definition.
      </NumberedItem>
      <P>
        Everything else is your call. We are not here to police your opinions, language,
        humor, or politics.
      </P>

      <Divider />

      <H2>Account termination</H2>
      <P>
        We will terminate accounts only for violations of the two rules above.
        We will not terminate accounts for speech we find offensive, unpopular, or
        politically inconvenient.
      </P>
      <P>
        If your account is terminated, you will receive notice explaining the reason.
        If a court order mandates termination without notice, we will tell you as soon
        as we are legally permitted.
      </P>

      <Divider />

      <H2>Channels and boards</H2>
      <P>
        Channel creators and Board founders may remove content from their own spaces
        and may set community-specific rules. This is limited to their space only.
      </P>
      <P>
        Being removed from a channel or board does not affect your Signoff Chat account.
        You remain free to use the rest of the platform.
      </P>

      <Divider />

      <H2>Gold membership</H2>
      <BulletList
        items={[
          "Billed monthly. No annual contracts.",
          "Cancel any time — your Gold benefits continue until the end of the paid period.",
          "No refunds on partial months. If you cancel mid-cycle, you keep Gold until it expires.",
          "We reserve the right to change the price with 30 days' notice. You can cancel before the new price takes effect.",
        ]}
      />

      <Divider />

      <H2>Tips</H2>
      <BulletList
        items={[
          "Tips are non-refundable once the payment is processed.",
          "Tips are sent from you to the recipient via Stripe. We take a small platform fee.",
          "We are not responsible for disputes between senders and recipients.",
        ]}
      />

      <Divider />

      <H2>Disclaimers</H2>
      <P>
        Signoff Chat is provided as-is. We make no guarantees of uptime, data preservation,
        or fitness for any particular purpose. We are not liable for content posted by
        users, for outages, or for indirect or consequential damages.
      </P>
      <P>
        Our liability to you is capped at the amount you paid us in the 12 months prior
        to any claim.
      </P>

      <Divider />

      <H2>Governing law</H2>
      <P>
        These terms are governed by the laws of the State of Delaware, United States,
        without regard to conflict of law provisions.
      </P>

      <Divider />

      <H2>Contact</H2>
      <P>
        Questions about these terms:{" "}
        <A href="mailto:legal@signoffchat.com">legal@signoffchat.com</A>
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
        marginBottom: 20,
      }}
    >
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
