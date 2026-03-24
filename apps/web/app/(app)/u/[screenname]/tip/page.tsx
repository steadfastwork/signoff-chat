"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { formatCents, TIP_MIN_CENTS, TIP_MAX_CENTS } from "@/lib/stripe-tips";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const PRESETS = [100, 500, 1000, 2500]; // cents

// ---------------------------------------------------------------------------
// Inner form (inside <Elements> context)
// ---------------------------------------------------------------------------

function TipForm({
  recipientScreenname,
  amountCents,
  message,
  onSuccess,
}: {
  recipientScreenname: string;
  amountCents: number;
  message: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed.");
      setSubmitting(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div
        className="rounded-2xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <PaymentElement />
      </div>

      {error && (
        <p className="text-[12px] font-mono" style={{ color: "#ef4444" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="w-full h-11 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-50"
        style={{ background: "var(--amber)", color: "#fff8e6" }}
      >
        {submitting
          ? "processing…"
          : `send ${formatCents(amountCents)} tip →`}
      </button>

      <p className="text-center text-[11px] font-mono" style={{ color: "var(--text-dim)" }}>
        to @{recipientScreenname} · secured by Stripe
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TipPage() {
  const params = useParams();
  const router = useRouter();
  const screenname = params.screenname as string;

  const [selectedCents, setSelectedCents] = useState<number>(PRESETS[1]);
  const [customInput, setCustomInput] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [message, setMessage] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountCents = isCustom
    ? Math.floor((parseFloat(customInput) || 0) * 100)
    : selectedCents;

  const amountValid =
    Number.isFinite(amountCents) &&
    amountCents >= TIP_MIN_CENTS &&
    amountCents <= TIP_MAX_CENTS;

  const handleCustomInput = (val: string) => {
    setCustomInput(val);
    setIsCustom(true);
  };

  const handlePreset = (cents: number) => {
    setSelectedCents(cents);
    setIsCustom(false);
    setCustomInput("");
  };

  const handleContinue = async () => {
    setLoadingIntent(true);
    setIntentError(null);
    try {
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientScreenname: screenname,
          amountCents,
          message: message.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIntentError(data.error ?? "Something went wrong.");
        return;
      }
      setClientSecret(data.clientSecret);
    } finally {
      setLoadingIntent(false);
    }
  };

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="text-center space-y-4 px-6">
          <p
            className="text-2xl font-vt323"
            style={{ color: "var(--amber)" }}
          >
            tip sent ★
          </p>
          <p className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>
            {formatCents(amountCents)} to @{screenname}
          </p>
          <button
            onClick={() => router.push(`/u/${screenname}`)}
            className="text-xs font-mono transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--amber)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")
            }
          >
            back to profile →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", fontFamily: "var(--font-dm-sans)" }}
    >
      <div className="max-w-md mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push(`/u/${screenname}`)}
            className="text-xs font-mono mb-4 block transition-colors"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--amber)")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLElement).style.color = "var(--text-muted)")
            }
          >
            ← @{screenname}
          </button>
          <h1
            className="font-vt323"
            style={{ fontSize: 28, color: "var(--amber)" }}
          >
            LEAVE A TIP
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            show some appreciation.
          </p>
        </div>

        {!clientSecret ? (
          <div className="flex flex-col gap-6">
            {/* Preset amounts */}
            <div>
              <p
                className="text-xs font-mono mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                amount
              </p>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {PRESETS.map((cents) => {
                  const active = !isCustom && selectedCents === cents;
                  return (
                    <button
                      key={cents}
                      onClick={() => handlePreset(cents)}
                      className="h-10 rounded-xl text-sm font-mono font-medium transition-all"
                      style={{
                        background: active ? "var(--amber)" : "var(--surface)",
                        color: active ? "#fff8e6" : "var(--text-muted)",
                        border: `1px solid ${active ? "var(--amber)" : "var(--border)"}`,
                      }}
                    >
                      {formatCents(cents)}
                    </button>
                  );
                })}
              </div>
              <input
                type="number"
                min="1"
                max="1000"
                step="0.01"
                placeholder="custom amount"
                value={customInput}
                onChange={(e) => handleCustomInput(e.target.value)}
                className="w-full h-10 rounded-xl px-4 text-sm font-mono outline-none transition-all"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: `1px solid ${isCustom ? "var(--amber)" : "var(--border)"}`,
                }}
              />
              {isCustom && !amountValid && customInput !== "" && (
                <p
                  className="text-[11px] font-mono mt-1"
                  style={{ color: "#ef4444" }}
                >
                  must be between $1 and $1,000
                </p>
              )}
            </div>

            {/* Message */}
            <div>
              <p
                className="text-xs font-mono mb-3"
                style={{ color: "var(--text-muted)" }}
              >
                message{" "}
                <span style={{ color: "var(--text-dim)" }}>(optional)</span>
              </p>
              <textarea
                maxLength={140}
                rows={3}
                placeholder="say something nice…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm font-mono outline-none resize-none transition-all"
                style={{
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                }}
              />
              <p
                className="text-right text-[10px] font-mono mt-1"
                style={{ color: "var(--text-dim)" }}
              >
                {message.length}/140
              </p>
            </div>

            {intentError && (
              <p
                className="text-[12px] font-mono"
                style={{ color: "#ef4444" }}
              >
                {intentError}
              </p>
            )}

            <button
              onClick={handleContinue}
              disabled={!amountValid || loadingIntent}
              className="w-full h-11 rounded-xl text-sm font-mono font-bold transition-all disabled:opacity-40"
              style={{ background: "var(--amber)", color: "#fff8e6" }}
            >
              {loadingIntent ? "loading…" : `continue →`}
            </button>
          </div>
        ) : (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "night",
                variables: {
                  colorPrimary: "#c8860a",
                  colorBackground: "#111110",
                  colorText: "#e8e4d0",
                  colorTextSecondary: "#6a6860",
                  borderRadius: "12px",
                },
              },
            }}
          >
            <TipForm
              recipientScreenname={screenname}
              amountCents={amountCents}
              message={message}
              onSuccess={() => setSuccess(true)}
            />
          </Elements>
        )}
      </div>
    </div>
  );
}
