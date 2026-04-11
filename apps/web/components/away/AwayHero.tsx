"use client";

import { useState } from "react";
import { CurrentlyDisplay } from "@/components/currently/CurrentlyDisplay";
import { AwayComposer } from "@/components/away/AwayComposer";
import { parseCurrently, type CurrentlyData } from "@/lib/currently";

interface AwayHeroProps {
  awayMessage: string | null;
  awayVisibility: "PUBLIC" | "BUDDIES" | "PRIVATE";
  currently: CurrentlyData;
  onSaved(msg: string, currently: CurrentlyData, visibility: "PUBLIC" | "BUDDIES" | "PRIVATE"): void;
}

export function AwayHero({ awayMessage, awayVisibility, currently, onSaved }: AwayHeroProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (
    msg: string,
    cur: CurrentlyData,
    visibility: "PUBLIC" | "BUDDIES" | "PRIVATE"
  ) => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          awayMessage: msg,
          awayVisibility: visibility,
          currently: Object.fromEntries(
            Object.entries(cur).map(([k, v]) => [k, v ?? ""])
          ),
          status: "AWAY",
        }),
      });
      if (res.ok) {
        setEditing(false);
        onSaved(msg, cur, visibility);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-5 transition-colors"
      style={{
        borderColor: editing ? "#c8860a33" : "#1a1a12",
        background: "#0a0a08",
      }}
    >
      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="w-full text-left"
        >
          {awayMessage ? (
            <div className="space-y-3">
              <p
                className="text-[17px] italic leading-relaxed"
                style={{
                  color: "var(--amber)",
                  fontFamily: "var(--font-dm-sans)",
                  borderLeft: "3px solid #c8860a44",
                  paddingLeft: "12px",
                }}
              >
                {awayMessage}
              </p>
              {Object.values(currently).some(Boolean) && (
                <CurrentlyDisplay
                  currently={parseCurrently(currently)}
                  size="compact"
                  maxCompact={6}
                />
              )}
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-mono"
                  style={{
                    color: "#3a3a2a",
                    background: "rgba(200,134,10,0.06)",
                    border: "1px solid #c8860a22",
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {awayVisibility === "PUBLIC"
                    ? "everyone"
                    : awayVisibility === "BUDDIES"
                    ? "buddies only"
                    : "private"}
                </span>
                <span
                  className="text-[11px] font-mono"
                  style={{ color: "#c8860a" }}
                >
                  update →
                </span>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-1">
              <p
                className="text-[15px] italic"
                style={{ color: "var(--text-dim)", fontFamily: "var(--font-dm-sans)" }}
              >
                what are you up to? where are you going?
              </p>
              <p
                className="text-[12px] font-mono"
                style={{ color: "var(--text-dim)" }}
              >
                tap to set your away message →
              </p>
            </div>
          )}
        </button>
      ) : (
        <AwayComposer
          initialMessage={awayMessage ?? ""}
          initialCurrently={currently}
          initialVisibility={awayVisibility}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      )}
      {saving && (
        <p className="text-[10px] font-mono mt-2" style={{ color: "var(--text-dim)" }}>
          saving…
        </p>
      )}
    </div>
  );
}
