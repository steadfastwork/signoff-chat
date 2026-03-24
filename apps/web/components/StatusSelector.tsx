"use client";

import { useState } from "react";
import { StatusDot, type StatusValue } from "@/components/StatusDot";
import { usePresence } from "@/components/PresenceProvider";

// The four statuses a user can manually set.
// OFFLINE is set automatically on logout — not shown here.
const OPTIONS: { status: StatusValue; label: string }[] = [
  { status: "ONLINE",    label: "Online" },
  { status: "AWAY",      label: "Away" },
  { status: "IDLE",      label: "Idle" },
  { status: "INVISIBLE", label: "Invisible" },
];

// ---- colour tokens --------------------------------------------------------
const ACTIVE_BG    = "rgba(200, 134, 10, 0.12)";
const ACTIVE_BORDER = "#c8860a";
const ACTIVE_TEXT  = "#c8860a";
const IDLE_BORDER  = "#2a2620";
const IDLE_TEXT    = "#8a7d6e";

interface StatusSelectorProps {
  /** Card / panel background so the dot ring matches. */
  bg?: string;
}

export function StatusSelector({ bg = "#1a1916" }: StatusSelectorProps) {
  const { status, updateStatus } = usePresence();
  const [pending, setPending] = useState<StatusValue | null>(null);

  async function handleSelect(next: StatusValue) {
    if (next === status || pending) return;
    setPending(next);
    await updateStatus(next);
    setPending(null);
  }

  return (
    <div
      className="grid grid-cols-2 gap-1.5"
      style={{ fontFamily: "var(--font-dm-sans), system-ui, sans-serif" }}
      role="group"
      aria-label="Status"
    >
      {OPTIONS.map(({ status: opt, label }) => {
        const isActive = status === opt;
        const isLoading = pending === opt;

        return (
          <button
            key={opt}
            type="button"
            disabled={!!pending}
            onClick={() => handleSelect(opt)}
            style={{
              height: 32,
              borderRadius: 8,
              fontSize: 12,
              border: `1px solid ${isActive ? ACTIVE_BORDER : IDLE_BORDER}`,
              background: isActive ? ACTIVE_BG : "transparent",
              color: isActive ? ACTIVE_TEXT : IDLE_TEXT,
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontWeight: isActive ? 600 : 400,
              cursor: pending ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingInline: 8,
            }}
          >
            <StatusDot status={opt} size="sm" bg={isActive ? "transparent" : bg} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
