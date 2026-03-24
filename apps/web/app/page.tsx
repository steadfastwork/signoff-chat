"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// CSS for scroll-reveal and landing-specific animations
// ---------------------------------------------------------------------------

const LP_STYLES = `
  .lp-reveal {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.55s ease, transform 0.55s ease;
  }
  .lp-reveal.lp-visible {
    opacity: 1;
    transform: translateY(0);
  }
  @keyframes lp-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  @keyframes lp-fade-down {
    from { opacity: 0; transform: translateY(-16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes lp-fade-up {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .lp-hero-head { animation: lp-fade-down 0.7s ease both; }
  .lp-hero-sub  { animation: lp-fade-up 0.7s 0.15s ease both; }
  .lp-hero-cta  { animation: lp-fade-up 0.7s 0.28s ease both; }
  .lp-hero-mock { animation: lp-fade-up 0.8s 0.4s ease both; }
`;

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

function Section({
  id,
  children,
  style,
}: {
  id?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <section
      id={id}
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "80px 24px",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-vt323"
      style={{
        fontSize: 14,
        color: "var(--text-dim)",
        textTransform: "uppercase",
        letterSpacing: "0.18em",
        marginBottom: 32,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Browser mockup
// ---------------------------------------------------------------------------

function BrowserMock() {
  return (
    <div
      className="lp-hero-mock"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
        maxWidth: 720,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Window chrome */}
      <div
        style={{
          background: "var(--card)",
          borderBottom: "1px solid var(--border)",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", gap: 5 }}>
          {(["#ff5f56", "#ffbd2e", "#27c93f"] as const).map((c) => (
            <span
              key={c}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: c,
                display: "block",
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 5,
            padding: "3px 10px",
            fontSize: 10,
            fontFamily: "var(--font-ibm-plex-mono)",
            color: "var(--text-dim)",
            textAlign: "center",
          }}
        >
          signoff.chat/feed
        </div>
      </div>

      {/* App UI */}
      <div style={{ display: "flex", height: 360, overflow: "hidden" }}>
        {/* Sidebar */}
        <div
          style={{
            width: 168,
            background: "var(--surface)",
            borderRight: "1px solid var(--border)",
            padding: "10px 8px",
            fontSize: 10,
            fontFamily: "var(--font-ibm-plex-mono)",
            flexShrink: 0,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              color: "var(--amber)",
              fontSize: 12,
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            SIGNOFF.CHAT
          </div>

          {/* My profile */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "var(--card)",
              borderRadius: 6,
              padding: "5px 6px",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: "#3d2a00",
                color: "var(--amber)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              CK
            </div>
            <div>
              <div style={{ color: "var(--text)", fontWeight: 600, fontSize: 10 }}>
                craig_k
              </div>
              <div style={{ color: "#22c55e", fontSize: 8 }}>● online</div>
            </div>
          </div>

          {/* Buddies */}
          <div
            style={{
              color: "var(--text-dim)",
              fontSize: 8,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 5,
            }}
          >
            Buddies
          </div>
          {[
            { init: "JR", name: "j_russo ★", bg: "#1e2a4a", col: "#93b4f8", dot: "#22c55e" },
            { init: "PW", name: "pam_w", bg: "#2d1a2a", col: "#f0a0c8", dot: "#22c55e" },
            { init: "MB", name: "mikeyb", bg: "#1a2a1a", col: "#86efac", dot: "#f59e0b" },
          ].map((b) => (
            <div
              key={b.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "3px 2px",
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: b.bg,
                  color: b.col,
                  fontSize: 7,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  flexShrink: 0,
                }}
              >
                {b.init}
                <span
                  style={{
                    position: "absolute",
                    bottom: -1,
                    right: -1,
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: b.dot,
                    border: "1px solid var(--surface)",
                  }}
                />
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: 9 }}>{b.name}</span>
            </div>
          ))}

          {/* Channels */}
          <div
            style={{
              color: "var(--text-dim)",
              fontSize: 8,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 4,
              marginTop: 10,
            }}
          >
            Channels
          </div>
          {["#general", "#tech"].map((c) => (
            <div key={c} style={{ color: "var(--text-muted)", padding: "2px 0", fontSize: 9 }}>
              {c}
            </div>
          ))}

          {/* Boards */}
          <div
            style={{
              color: "var(--text-dim)",
              fontSize: 8,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 4,
              marginTop: 10,
            }}
          >
            Boards
          </div>
          {["/photos", "/random"].map((b) => (
            <div key={b} style={{ color: "var(--teal)", padding: "2px 0", fontSize: 9 }}>
              {b}
            </div>
          ))}
        </div>

        {/* Main feed */}
        <div style={{ flex: 1, background: "var(--bg)", overflow: "hidden", minWidth: 0 }}>
          {/* Inner topbar */}
          <div
            style={{
              background: "var(--surface)",
              borderBottom: "1px solid var(--border)",
              padding: "0 12px",
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-vt323)",
                fontSize: 14,
                color: "var(--amber)",
              }}
            >
              // feed
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 9,
                fontFamily: "var(--font-ibm-plex-mono)",
                color: "#22c55e",
              }}
            >
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "#22c55e",
                  display: "inline-block",
                  animation: "lp-pulse 2s ease-in-out infinite",
                }}
              />
              encrypted
            </span>
          </div>

          {/* Feed items */}
          <div
            style={{
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              overflow: "hidden",
            }}
          >
            {/* Composer */}
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                padding: "7px 8px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "#3d2a00",
                    color: "var(--amber)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 8,
                    flexShrink: 0,
                  }}
                >
                  CK
                </div>
                <span
                  style={{
                    fontSize: 9,
                    color: "var(--text-dim)",
                    fontFamily: "var(--font-ibm-plex-mono)",
                  }}
                >
                  What&apos;s on your mind?
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 3 }}>
                  {["📷 Photo", "🎬 Video", "GIF"].map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 7,
                        color: "var(--text-dim)",
                        border: "1px solid var(--border)",
                        borderRadius: 3,
                        padding: "1px 4px",
                        fontFamily: "var(--font-ibm-plex-mono)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    fontSize: 7,
                    background: "var(--amber)",
                    color: "#000",
                    borderRadius: 3,
                    padding: "1px 7px",
                    fontFamily: "var(--font-ibm-plex-mono)",
                    fontWeight: 700,
                  }}
                >
                  Send
                </div>
              </div>
            </div>

            {/* Posts */}
            {[
              {
                init: "JR",
                bg: "#1e2a4a",
                col: "#93b4f8",
                name: "j_russo ★",
                time: "3 min ago",
                emoji: "⛈",
                body: "there is something deeply calming about a thunderstorm at 2am when you have nowhere to be.",
                nudged: true,
              },
              {
                init: "PW",
                bg: "#2d1a2a",
                col: "#f0a0c8",
                name: "pam_w",
                time: "18 min ago",
                emoji: "🍲",
                body: "finished the soup. made too much as always. logging off early.",
                nudged: false,
              },
            ].map((p) => (
              <div
                key={p.name}
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  padding: "7px 8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 5,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: p.bg,
                        color: p.col,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 7,
                        position: "relative",
                        flexShrink: 0,
                      }}
                    >
                      {p.init}
                      <span
                        style={{
                          position: "absolute",
                          bottom: -1,
                          right: -1,
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: "#22c55e",
                          border: "1px solid var(--card)",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        fontFamily: "var(--font-ibm-plex-mono)",
                        color: "var(--text)",
                      }}
                    >
                      {p.name}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 8,
                      color: "var(--text-dim)",
                      fontFamily: "var(--font-ibm-plex-mono)",
                    }}
                  >
                    {p.time}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 22,
                    textAlign: "center",
                    padding: "5px 0",
                    marginBottom: 4,
                  }}
                >
                  {p.emoji}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--text-muted)",
                    marginBottom: 5,
                    fontFamily: "var(--font-dm-sans)",
                    lineHeight: 1.4,
                  }}
                >
                  {p.body}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 8,
                      color: p.nudged ? "var(--amber)" : "var(--text-dim)",
                      fontFamily: "var(--font-ibm-plex-mono)",
                    }}
                  >
                    👋 nudge
                  </span>
                  <span
                    style={{
                      fontSize: 8,
                      color: "var(--text-dim)",
                      fontFamily: "var(--font-ibm-plex-mono)",
                    }}
                  >
                    💬 reply
                  </span>
                  <span
                    style={{
                      fontSize: 8,
                      color: "var(--text-dim)",
                      fontFamily: "var(--font-ibm-plex-mono)",
                    }}
                  >
                    🔖 save
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pillar card
// ---------------------------------------------------------------------------

function PillarCard({
  num,
  icon,
  title,
  desc,
  delay = 0,
}: {
  num: string;
  icon: string;
  title: string;
  desc: string;
  delay?: number;
}) {
  return (
    <div
      className="lp-reveal"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "24px 20px",
        transitionDelay: `${delay}s`,
      }}
    >
      <span style={{ fontSize: 28, display: "block", marginBottom: 10 }}>{icon}</span>
      <div
        className="font-vt323"
        style={{ fontSize: 12, color: "var(--text-dim)", letterSpacing: "0.1em", marginBottom: 6 }}
      >
        {num}
      </div>
      <div
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontWeight: 600,
          fontSize: 15,
          color: "var(--text)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 13,
          color: "var(--text-muted)",
          lineHeight: 1.6,
        }}
      >
        {desc}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature card
// ---------------------------------------------------------------------------

function FeatureCard({
  icon,
  title,
  desc,
  delay = 0,
}: {
  icon: string;
  title: string;
  desc: string;
  delay?: number;
}) {
  return (
    <div
      className="lp-reveal"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "20px",
        display: "flex",
        gap: 14,
        transitionDelay: `${delay}s`,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontWeight: 600,
            fontSize: 14,
            color: "var(--text)",
            marginBottom: 5,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 13,
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pricing card
// ---------------------------------------------------------------------------

function PriceCard({
  tier,
  amount,
  period,
  features,
  ctaLabel,
  ctaHref,
  featured = false,
  delay = 0,
}: {
  tier: string;
  amount: React.ReactNode;
  period: string;
  features: { text: string; on: boolean }[];
  ctaLabel: string;
  ctaHref: string;
  featured?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="lp-reveal"
      style={{
        background: featured ? "var(--card)" : "var(--surface)",
        border: featured ? "1px solid var(--amber)" : "1px solid var(--border)",
        borderRadius: 12,
        padding: "28px 24px",
        position: "relative",
        transitionDelay: `${delay}s`,
        boxShadow: featured ? "0 0 32px rgba(245,158,11,0.12)" : "none",
      }}
    >
      {featured && (
        <div
          style={{
            position: "absolute",
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--amber)",
            color: "#000",
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "var(--font-ibm-plex-mono)",
            padding: "3px 12px",
            borderRadius: 20,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            whiteSpace: "nowrap",
          }}
        >
          most popular
        </div>
      )}
      <div
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-dim)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 8,
        }}
      >
        {tier}
      </div>
      <div
        style={{
          fontFamily: "var(--font-dm-serif, Georgia, serif)",
          fontSize: 52,
          lineHeight: 1,
          color: featured ? "var(--amber)" : "var(--text)",
          marginBottom: 4,
        }}
      >
        {amount}
      </div>
      <div
        style={{
          fontFamily: "var(--font-ibm-plex-mono)",
          fontSize: 11,
          color: "var(--text-dim)",
          marginBottom: 20,
        }}
      >
        {period}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
        {features.map((f) => (
          <li
            key={f.text}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              fontFamily: "var(--font-dm-sans)",
              color: f.on ? "var(--text)" : "var(--text-dim)",
            }}
          >
            <span style={{ color: f.on ? "var(--amber)" : "var(--border)", fontSize: 12, flexShrink: 0 }}>
              {f.on ? "✓" : "—"}
            </span>
            {f.text}
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        style={{
          display: "block",
          textAlign: "center",
          padding: "10px 16px",
          borderRadius: 7,
          fontSize: 13,
          fontFamily: "var(--font-ibm-plex-mono)",
          fontWeight: 600,
          background: featured ? "var(--amber)" : "transparent",
          color: featured ? "#000" : "var(--text-muted)",
          border: featured ? "none" : "1px solid var(--border)",
          textDecoration: "none",
          transition: "opacity 0.2s",
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const [onlineText, setOnlineText] = useState("3,847 online now · 12,291 away");

  // Ticking online count
  useEffect(() => {
    function updateCount() {
      const online = 3847 + Math.floor(Math.random() * 40) - 20;
      const away = 12291 + Math.floor(Math.random() * 60) - 30;
      setOnlineText(`${online.toLocaleString()} online now · ${away.toLocaleString()} away`);
    }
    const id = setInterval(updateCount, 8000);
    return () => clearInterval(id);
  }, []);

  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("lp-visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".lp-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{LP_STYLES}</style>

      <main
        style={{
          paddingTop: 52,
          background: "var(--bg)",
          color: "var(--text)",
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section
          style={{
            textAlign: "center",
            padding: "80px 24px 60px",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          {/* Online count pill */}
          <div
            className="lp-hero-head"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 20,
              padding: "5px 14px",
              fontSize: 11,
              fontFamily: "var(--font-ibm-plex-mono)",
              color: "var(--text-muted)",
              marginBottom: 32,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
                animation: "lp-pulse 2s ease-in-out infinite",
              }}
            />
            {onlineText}
          </div>

          {/* Headline */}
          <h1
            className="lp-hero-head"
            style={{
              fontFamily: "var(--font-dm-serif, Georgia, serif)",
              fontSize: "clamp(40px, 7vw, 72px)",
              lineHeight: 1.1,
              color: "var(--text)",
              margin: "0 0 20px",
              animationDelay: "0.05s",
            }}
          >
            The internet,
            <br />
            before it got{" "}
            <em style={{ color: "var(--amber)", fontStyle: "italic" }}>weird.</em>
          </h1>

          {/* Sub */}
          <p
            className="lp-hero-sub"
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: "clamp(15px, 2.5vw, 18px)",
              color: "var(--text-muted)",
              maxWidth: 520,
              margin: "0 auto 36px",
              lineHeight: 1.65,
            }}
          >
            A screenname, a buddy list, and a place to say something true. No algorithm.
            No engagement bait. End-to-end encrypted. Sign on. Sign off.
          </p>

          {/* CTAs */}
          <div
            className="lp-hero-cta"
            style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
          >
            <Link
              href="/register"
              style={{
                background: "var(--amber)",
                color: "#000",
                padding: "12px 28px",
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "var(--font-ibm-plex-mono)",
                fontWeight: 700,
                textDecoration: "none",
                letterSpacing: "0.03em",
              }}
            >
              Get your screenname →
            </Link>
            <a
              href="#features"
              style={{
                background: "transparent",
                color: "var(--text-muted)",
                padding: "12px 28px",
                borderRadius: 8,
                fontSize: 14,
                fontFamily: "var(--font-ibm-plex-mono)",
                textDecoration: "none",
                border: "1px solid var(--border)",
              }}
            >
              See how it works
            </a>
          </div>
        </section>

        {/* Browser mockup */}
        <div style={{ padding: "0 16px 80px" }}>
          <BrowserMock />
        </div>

        {/* ── PILLARS ──────────────────────────────────────────────────── */}
        <Section id="features">
          <SectionLabel>why signoff</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {[
              { num: "[01]", icon: "🔒", title: "End-to-end encrypted", desc: "Every message travels sealed. Nobody reads your words but the people you sent them to. No exceptions.", delay: 0 },
              { num: "[02]", icon: "🗣️", title: "Speak freely", desc: "We only remove what the law requires. No shadowbanning. No algorithm quietly deciding you said the wrong thing.", delay: 0.08 },
              { num: "[03]", icon: "🌿", title: "Disconnect proudly", desc: "Away mode is a feature, not a failure. Log on, say something real, then go live your actual life.", delay: 0.16 },
              { num: "[04]", icon: "👥", title: "Buddies, not followers", desc: "You add people. They add you back. No follower counts. No vanity metrics. No strangers in your feed.", delay: 0.24 },
              { num: "[05]", icon: "◈", title: "Boards for everything", desc: "Threaded discussions, topic tags, and community spaces — without the algorithm deciding what you see.", delay: 0.32 },
            ].map((p) => (
              <PillarCard key={p.num} {...p} />
            ))}
          </div>
        </Section>

        {/* ── FEATURE CARDS ────────────────────────────────────────────── */}
        <Section style={{ paddingTop: 0 }}>
          <SectionLabel>everything included</SectionLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {[
              { icon: "📷", title: "Photos & videos", desc: "Attach photos, videos, and GIFs to any post or away message. Share the moment, then sign off.", delay: 0 },
              { icon: "💬", title: "Channels", desc: "IRC-inspired topic rooms. Join conversations that interest you. Only mutual rooms show on profiles.", delay: 0.06 },
              { icon: "👋", title: "Nudges", desc: "The AIM buzz, reimagined. Tap to nudge a post you felt. No like counts to chase. Just a human gesture.", delay: 0.12 },
              { icon: "✍️", title: "Away messages", desc: "The original microblog. Set your status, say something true, and let your buddies know where you went.", delay: 0.18 },
              { icon: "🌙", title: "Dark & light mode", desc: "The app looks exactly how you want it. Dark for late nights, light for Sunday mornings. Your call.", delay: 0.24 },
              { icon: "💛", title: "Tip jar", desc: "Send a tip to someone whose post made your day. We take a small cut. No subscriptions required.", delay: 0.3 },
            ].map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </Section>

        {/* ── BOARDS SPOTLIGHT ─────────────────────────────────────────── */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20,184,166,0.06) 0%, transparent 60%)",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <Section>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 48,
                alignItems: "center",
              }}
            >
              {/* Copy */}
              <div>
                <div
                  className="font-vt323 lp-reveal"
                  style={{
                    fontSize: 13,
                    color: "var(--teal)",
                    textTransform: "uppercase",
                    letterSpacing: "0.18em",
                    marginBottom: 16,
                  }}
                >
                  [boards]
                </div>
                <h2
                  className="lp-reveal"
                  style={{
                    fontFamily: "var(--font-dm-serif, Georgia, serif)",
                    fontSize: "clamp(28px, 4vw, 44px)",
                    lineHeight: 1.15,
                    color: "var(--text)",
                    margin: "0 0 16px",
                    transitionDelay: "0.08s",
                  }}
                >
                  A place for longer{" "}
                  <em style={{ color: "var(--teal)", fontStyle: "italic" }}>thoughts.</em>
                </h2>
                <p
                  className="lp-reveal"
                  style={{
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: 15,
                    color: "var(--text-muted)",
                    lineHeight: 1.7,
                    margin: "0 0 24px",
                    transitionDelay: "0.16s",
                  }}
                >
                  Threaded discussions organized by topic. Post a question, share a find, start
                  a debate. Boards have their own communities, their own rules, their own vibe.
                  No main feed noise.
                </p>
                <div
                  className="lp-reveal"
                  style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    transitionDelay: "0.24s",
                  }}
                >
                  {["/photos", "/music", "/random", "/tech"].map((b) => (
                    <span
                      key={b}
                      style={{
                        background: "rgba(20,184,166,0.1)",
                        border: "1px solid rgba(20,184,166,0.3)",
                        borderRadius: 6,
                        padding: "4px 10px",
                        fontSize: 12,
                        fontFamily: "var(--font-ibm-plex-mono)",
                        color: "var(--teal)",
                      }}
                    >
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* Mock board post */}
              <div
                className="lp-reveal"
                style={{
                  background: "var(--card)",
                  border: "1px solid rgba(20,184,166,0.25)",
                  borderRadius: 12,
                  overflow: "hidden",
                  transitionDelay: "0.1s",
                }}
              >
                {/* Board header */}
                <div
                  style={{
                    background: "rgba(20,184,166,0.08)",
                    borderBottom: "1px solid rgba(20,184,166,0.2)",
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-vt323)",
                      fontSize: 16,
                      color: "var(--teal)",
                    }}
                  >
                    /music
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "var(--font-ibm-plex-mono)",
                      color: "var(--text-dim)",
                    }}
                  >
                    342 members
                  </span>
                </div>
                {/* Board post */}
                <div style={{ padding: "14px" }}>
                  <div
                    style={{
                      fontFamily: "var(--font-dm-sans)",
                      fontWeight: 600,
                      fontSize: 14,
                      color: "var(--text)",
                      marginBottom: 6,
                    }}
                  >
                    Best thunderstorm albums? 🎵
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-dm-sans)",
                      marginBottom: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    Looking for something moody and atmospheric for a rainy night. Go.
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                    {["ambient", "moody", "rain"].map((tag) => (
                      <span
                        key={tag}
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          padding: "2px 7px",
                          fontSize: 10,
                          fontFamily: "var(--font-ibm-plex-mono)",
                          color: "var(--text-dim)",
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  {/* Replies */}
                  <div
                    style={{
                      borderTop: "1px solid var(--border)",
                      paddingTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    {[
                      { init: "JR", col: "#93b4f8", name: "j_russo", text: "Grouper — Dragging a Dead Deer. Full stop." },
                      { init: "PW", col: "#f0a0c8", name: "pam_w", text: "anything by Mazzy Star honestly" },
                    ].map((r) => (
                      <div key={r.name} style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "var(--surface)",
                            color: r.col,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 7,
                            flexShrink: 0,
                            fontFamily: "var(--font-ibm-plex-mono)",
                          }}
                        >
                          {r.init}
                        </div>
                        <div>
                          <span
                            style={{
                              fontSize: 9,
                              fontFamily: "var(--font-ibm-plex-mono)",
                              color: "var(--text-muted)",
                              marginRight: 5,
                            }}
                          >
                            {r.name}
                          </span>
                          <span
                            style={{
                              fontSize: 10,
                              fontFamily: "var(--font-dm-sans)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {r.text}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div
                      style={{
                        fontSize: 9,
                        color: "var(--teal)",
                        fontFamily: "var(--font-ibm-plex-mono)",
                        marginTop: 2,
                      }}
                    >
                      14 more replies →
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* ── CHANNELS SPOTLIGHT ───────────────────────────────────────── */}
        <Section>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 48,
              alignItems: "center",
            }}
          >
            {/* Mock channel */}
            <div
              className="lp-reveal"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Channel header */}
              <div
                style={{
                  background: "var(--surface)",
                  borderBottom: "1px solid var(--border)",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-vt323)",
                    fontSize: 16,
                    color: "var(--amber)",
                  }}
                >
                  #general
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-ibm-plex-mono)",
                    color: "#22c55e",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "#22c55e",
                      display: "inline-block",
                    }}
                  />
                  12 online
                </span>
              </div>
              {/* Messages */}
              <div
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {[
                  { init: "JR", col: "#93b4f8", name: "j_russo", time: "9:41 PM", text: "anyone else watching the storm roll in?" },
                  { init: "MB", col: "#86efac", name: "mikeyb", time: "9:42 PM", text: "yeah its wild out here. lights flickered twice" },
                  { init: "PW", col: "#f0a0c8", name: "pam_w", time: "9:43 PM", text: "power's out on my block lol. typing by candlelight 🕯" },
                  { init: "JR", col: "#93b4f8", name: "j_russo", time: "9:44 PM", text: "that's genuinely the most romantic thing I've ever read on here" },
                ].map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "var(--surface)",
                        color: m.col,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 8,
                        flexShrink: 0,
                        fontFamily: "var(--font-ibm-plex-mono)",
                      }}
                    >
                      {m.init}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                        <span
                          style={{
                            fontSize: 10,
                            fontFamily: "var(--font-ibm-plex-mono)",
                            color: m.col,
                            fontWeight: 600,
                          }}
                        >
                          {m.name}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontFamily: "var(--font-ibm-plex-mono)",
                            color: "var(--text-dim)",
                          }}
                        >
                          {m.time}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontFamily: "var(--font-dm-sans)",
                          color: "var(--text-muted)",
                          lineHeight: 1.4,
                        }}
                      >
                        {m.text}
                      </div>
                    </div>
                  </div>
                ))}
                {/* Composer stub */}
                <div
                  style={{
                    marginTop: 4,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 10,
                    fontFamily: "var(--font-ibm-plex-mono)",
                    color: "var(--text-dim)",
                  }}
                >
                  message #general…
                </div>
              </div>
            </div>

            {/* Copy */}
            <div>
              <div
                className="font-vt323 lp-reveal"
                style={{
                  fontSize: 13,
                  color: "var(--amber)",
                  textTransform: "uppercase",
                  letterSpacing: "0.18em",
                  marginBottom: 16,
                }}
              >
                [channels]
              </div>
              <h2
                className="lp-reveal"
                style={{
                  fontFamily: "var(--font-dm-serif, Georgia, serif)",
                  fontSize: "clamp(28px, 4vw, 44px)",
                  lineHeight: 1.15,
                  color: "var(--text)",
                  margin: "0 0 16px",
                  transitionDelay: "0.08s",
                }}
              >
                Real-time rooms,{" "}
                <em style={{ color: "var(--amber)", fontStyle: "italic" }}>retro soul.</em>
              </h2>
              <p
                className="lp-reveal"
                style={{
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: 15,
                  color: "var(--text-muted)",
                  lineHeight: 1.7,
                  margin: "0 0 20px",
                  transitionDelay: "0.16s",
                }}
              >
                Jump into any channel, talk live, or scroll back through what you missed. Like
                IRC, but it doesn&apos;t look like 1995. Public, invite-only, or secret — you
                control who gets in.
              </p>
              <div
                className="lp-reveal"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  transitionDelay: "0.24s",
                }}
              >
                {[
                  { icon: "🔒", text: "End-to-end encrypted messages" },
                  { icon: "🕹️", text: "Slow mode to keep conversations civil" },
                  { icon: "🔗", text: "Invite links with expiry and use limits" },
                ].map((item) => (
                  <div
                    key={item.text}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontSize: 13,
                      fontFamily: "var(--font-dm-sans)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        flexShrink: 0,
                      }}
                    >
                      {item.icon}
                    </span>
                    {item.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── MANIFESTO ────────────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            textAlign: "center",
            padding: "80px 24px",
            overflow: "hidden",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {/* Background watermark */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            <span
              className="font-vt323"
              style={{
                fontSize: "clamp(80px, 18vw, 200px)",
                color: "var(--border)",
                opacity: 0.6,
                lineHeight: 1,
                letterSpacing: "0.12em",
              }}
            >
              SIGNOFF
            </span>
          </div>

          {/* Quote */}
          <p
            className="lp-reveal"
            style={{
              position: "relative",
              fontFamily: "var(--font-dm-serif, Georgia, serif)",
              fontSize: "clamp(20px, 3vw, 28px)",
              lineHeight: 1.7,
              color: "var(--text-muted)",
              maxWidth: 560,
              margin: "0 auto",
            }}
          >
            The internet used to feel like{" "}
            <em style={{ color: "var(--text)", fontStyle: "italic" }}>something.</em>
            <br />
            You logged on. You said what you meant.
            <br />
            You signed off and went outside.
            <br />
            <em style={{ color: "var(--amber)", fontStyle: "italic" }}>
              We&apos;re bringing that back.
            </em>
          </p>
        </div>

        {/* ── PRICING ──────────────────────────────────────────────────── */}
        <Section>
          <SectionLabel>pricing</SectionLabel>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: 15,
              color: "var(--text-muted)",
              maxWidth: 480,
              marginBottom: 40,
              lineHeight: 1.6,
            }}
          >
            Simple and honest. No dark patterns. No annual lock-in. No surprise charges.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 20,
              alignItems: "start",
            }}
          >
            <PriceCard
              tier="Free forever"
              amount="$0"
              period="always, no card required"
              features={[
                { text: "Screenname + buddy list", on: true },
                { text: "Posts + away messages", on: true },
                { text: "Photo, video & GIF uploads", on: true },
                { text: "5 channels", on: true },
                { text: "End-to-end encryption", on: true },
                { text: "90 days post history", on: true },
                { text: "Profile photo upload", on: false },
                { text: "Custom themes", on: false },
                { text: "★ Gold badge", on: false },
              ]}
              ctaLabel="Get started"
              ctaHref="/register"
              delay={0}
            />
            <PriceCard
              tier="Gold member"
              amount="$4"
              period="per month · cancel anytime"
              features={[
                { text: "Everything in Free", on: true },
                { text: "Unlimited post history", on: true },
                { text: "Profile photo upload", on: true },
                { text: "Custom profile themes", on: true },
                { text: "★ Gold badge on your name", on: true },
                { text: "Custom emoticon packs", on: true },
                { text: "Retro sound packs", on: true },
                { text: "Priority support", on: true },
              ]}
              ctaLabel="Go Gold →"
              ctaHref="/register"
              featured
              delay={0.08}
            />
            <PriceCard
              tier="Tip jar"
              amount="👋"
              period="send & receive tips"
              features={[
                { text: "Tip users you love", on: true },
                { text: "Any amount from $1", on: true },
                { text: "Optional message with tip", on: true },
                { text: "We take a small cut", on: true },
                { text: "No subscription needed", on: true },
              ]}
              ctaLabel="Learn more"
              ctaHref="/register"
              delay={0.16}
            />
          </div>
        </Section>

        {/* ── FOOTER ───────────────────────────────────────────────────── */}
        <footer
          style={{
            borderTop: "1px solid var(--border)",
            padding: "40px 24px 32px",
            textAlign: "center",
          }}
        >
          <div
            className="font-vt323"
            style={{
              fontSize: 28,
              color: "var(--amber)",
              letterSpacing: "0.12em",
              marginBottom: 8,
            }}
          >
            SIGNOFF.CHAT
          </div>
          <div
            style={{
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 12,
              color: "var(--text-dim)",
              marginBottom: 20,
            }}
          >
            speak freely. disconnect proudly.
          </div>
          <ul
            style={{
              display: "flex",
              gap: 24,
              justifyContent: "center",
              listStyle: "none",
              padding: 0,
              margin: "0 0 20px",
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Privacy", href: "/privacy" },
              { label: "Terms", href: "/terms" },
              { label: "Moderation", href: "/moderation-policy" },
              { label: "Security", href: "#" },
              { label: "Contact", href: "mailto:hello@signoffchat.com" },
            ].map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  style={{
                    fontSize: 12,
                    fontFamily: "var(--font-ibm-plex-mono)",
                    color: "var(--text-dim)",
                    textDecoration: "none",
                  }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div
            style={{
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 11,
              color: "var(--text-dim)",
              opacity: 0.6,
            }}
          >
            © {new Date().getFullYear()} Signoff Chat · no ads · no tracking · no nonsense
          </div>
        </footer>
      </main>
    </>
  );
}
