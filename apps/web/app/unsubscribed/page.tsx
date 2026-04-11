import Link from "next/link";

// ---------------------------------------------------------------------------
// /unsubscribed — shown after successful email unsubscribe
// Supports ?from=digest to customize the message.
// ---------------------------------------------------------------------------

interface Props {
  searchParams: { from?: string };
}

export default function UnsubscribedPage({ searchParams }: Props) {
  const from = searchParams.from;

  const message =
    from === "digest"
      ? "You've been unsubscribed from the daily away message digest."
      : "You've been unsubscribed.";

  return (
    <div className="min-h-screen flex items-center justify-center font-mono" style={{ background: "#0d0d0b" }}>
      <div className="max-w-md w-full mx-auto p-8 border border-[#2a2620]">
        <p className="text-2xl font-vt323 mb-4" style={{ color: "#c8860a" }}>
          SIGNOFF.CHAT
        </p>
        <p className="text-sm mb-6" style={{ color: "#e8ddd0" }}>
          {message}
        </p>
        {from === "digest" && (
          <p className="text-xs mb-6" style={{ color: "#6b6055" }}>
            You can re-enable the digest any time from your{" "}
            <Link href="/settings/digest" style={{ color: "#c8860a" }}>
              digest settings
            </Link>
            .
          </p>
        )}
        <Link
          href="/feed"
          className="text-xs underline"
          style={{ color: "#6b6055" }}
        >
          back to signoff.chat
        </Link>
      </div>
    </div>
  );
}
