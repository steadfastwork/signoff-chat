"use client";

import { useState, useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Modal copy — exact text from spec
// ---------------------------------------------------------------------------

const MODAL_TITLE = "How your messages are protected";
const MODAL_BODY = `Your messages are protected by two independent layers of encryption.

AES-256 is the gold standard used by banks, governments, and militaries worldwide. It has never been broken.

ML-KEM (FIPS 203) is a new post-quantum standard built to resist attacks from future quantum computers — the same approach now used by Apple and Signal.

Both would need to be broken at the same time for anyone to read your messages. We cannot read them. Not us. Not anyone.`;

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function EncryptionModal({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleBackdrop}
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="enc-modal-title"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border p-6"
        style={{
          background: "var(--surface)",
          borderColor: "var(--border-bright)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 18 }}>🔒</span>
            <h2
              id="enc-modal-title"
              className="text-sm font-semibold"
              style={{ color: "var(--text)", fontFamily: "var(--font-dm-sans)" }}
            >
              {MODAL_TITLE}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-xs font-mono transition-colors"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--text-dim)")
            }
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-3">
          {MODAL_BODY.split("\n\n").map((para, i) => (
            <p
              key={i}
              className="text-sm leading-relaxed"
              style={{
                color: "var(--text-muted)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {para}
            </p>
          ))}
        </div>

        {/* Tech details */}
        <div
          className="mt-5 rounded-xl border px-4 py-3 grid grid-cols-2 gap-3"
          style={{
            borderColor: "var(--border)",
            background: "var(--card)",
          }}
        >
          <div>
            <p
              className="text-[10px] font-mono uppercase tracking-widest mb-0.5"
              style={{ color: "var(--text-dim)" }}
            >
              Symmetric
            </p>
            <p
              className="text-xs font-semibold font-mono"
              style={{ color: "var(--text)" }}
            >
              AES-256-GCM
            </p>
          </div>
          <div>
            <p
              className="text-[10px] font-mono uppercase tracking-widest mb-0.5"
              style={{ color: "var(--text-dim)" }}
            >
              Post-Quantum KEM
            </p>
            <p
              className="text-xs font-semibold font-mono"
              style={{ color: "var(--text)" }}
            >
              ML-KEM-1024
            </p>
            <p
              className="text-[10px] font-mono"
              style={{ color: "var(--text-dim)" }}
            >
              NIST FIPS 203
            </p>
          </div>
          <div>
            <p
              className="text-[10px] font-mono uppercase tracking-widest mb-0.5"
              style={{ color: "var(--text-dim)" }}
            >
              Key Derivation
            </p>
            <p
              className="text-xs font-semibold font-mono"
              style={{ color: "var(--text)" }}
            >
              HKDF-SHA256
            </p>
          </div>
          <div>
            <p
              className="text-[10px] font-mono uppercase tracking-widest mb-0.5"
              style={{ color: "var(--text-dim)" }}
            >
              As used by
            </p>
            <p
              className="text-xs font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              Apple iMessage PQ3
              <br />
              Signal PQXDH
            </p>
          </div>
        </div>

        <p
          className="mt-4 text-[11px] font-mono text-center"
          style={{ color: "var(--text-dim)" }}
        >
          powered by @noble/post-quantum · FIPS 203 certified
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge (the persistent navbar pill)
// ---------------------------------------------------------------------------

export function EncryptionBadge() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border transition-all select-none"
        style={{
          background: "rgba(200,134,10,0.06)",
          borderColor: "rgba(200,134,10,0.25)",
          color: "var(--amber)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(200,134,10,0.12)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(200,134,10,0.06)";
        }}
        title="Learn about our encryption"
        aria-label="Encryption info"
      >
        🔒 AES-256 + ML-KEM
      </button>

      {open && <EncryptionModal onClose={() => setOpen(false)} />}
    </>
  );
}
