"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Common timezones offered in the UI
// ---------------------------------------------------------------------------

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

// ---------------------------------------------------------------------------
// Generate 30-minute interval options: 00:00, 00:30, 01:00, … 23:30
// ---------------------------------------------------------------------------

function generateTimeOptions(): string[] {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      times.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return times;
}

const TIME_OPTIONS = generateTimeOptions();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DigestSettings {
  digestEnabled: boolean;
  digestTime: string;
  digestTimezone: string;
  hasEmail: boolean;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DigestSettingsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [settings, setSettings] = useState<DigestSettings | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Load settings
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!session) {
      router.push("/login");
      return;
    }
    fetch("/api/user/digest")
      .then((r) => r.json())
      .then((data: DigestSettings) => {
        setSettings(data);
        setEnabled(data.digestEnabled);
        setTime(data.digestTime);
        setTimezone(data.digestTimezone);
      })
      .catch(() => setError("failed to load settings."));
  }, [session, router]);

  // -----------------------------------------------------------------------
  // Save settings
  // -----------------------------------------------------------------------

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);

    const body: Record<string, unknown> = { digestEnabled: enabled };
    if (enabled) {
      body.digestTime = time;
      body.digestTimezone = timezone;
    }

    try {
      const res = await fetch("/api/user/digest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "something went wrong.");
      } else {
        const updated = await res.json() as DigestSettings;
        setSettings(updated);
        setSaved(true);
      }
    } catch {
      setError("network error. try again.");
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (!settings) {
    return (
      <div className="max-w-xl mx-auto p-8 font-mono text-green-800 animate-pulse">
        loading...
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-xl mx-auto p-4 font-mono">
      <div className="border border-green-950 bg-black">
        {/* Header */}
        <div className="border-b border-green-950 p-4">
          <h1 className="font-vt323 text-2xl text-green-400">{"// DIGEST SETTINGS"}</h1>
          <p className="text-green-700 text-xs mt-1">
            {"We'll send you a summary of away messages from your buddies once per day."}
          </p>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* No email warning */}
          {!settings.hasEmail && (
            <div className="border border-yellow-900 bg-yellow-950/20 px-4 py-3">
              <p className="text-yellow-600 text-xs">
                no email on file — digest emails are unavailable for your account.
              </p>
            </div>
          )}

          {/* Toggle */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setEnabled((v) => !v);
                setSaved(false);
              }}
              disabled={!settings.hasEmail}
              className={`w-10 h-6 border transition-colors relative disabled:opacity-30 ${
                enabled
                  ? "border-green-600 bg-green-950"
                  : "border-green-950 bg-black"
              }`}
              aria-pressed={enabled}
              aria-label="Toggle daily digest"
            >
              <span
                className={`absolute top-0.5 w-4 h-4 transition-all ${
                  enabled ? "left-5 bg-green-500" : "left-0.5 bg-green-900"
                }`}
              />
            </button>
            <span className="text-green-400 text-sm">
              {enabled ? "digest enabled" : "digest disabled"}
            </span>
          </div>

          {/* Time & timezone — only shown when enabled */}
          {enabled && (
            <>
              {/* Delivery time */}
              <div>
                <p className="text-green-700 text-xs uppercase tracking-wider mb-2">
                  delivery time
                </p>
                <select
                  value={time}
                  onChange={(e) => { setTime(e.target.value); setSaved(false); }}
                  className="bg-black border border-green-900 text-green-300 text-sm px-2 py-1.5 outline-none focus:border-green-600"
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timezone */}
              <div>
                <p className="text-green-700 text-xs uppercase tracking-wider mb-2">
                  timezone
                </p>
                <select
                  value={timezone}
                  onChange={(e) => { setTimezone(e.target.value); setSaved(false); }}
                  className="bg-black border border-green-900 text-green-300 text-sm px-2 py-1.5 outline-none focus:border-green-600 w-full max-w-xs"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Feedback */}
          {saved && (
            <p className="text-green-500 text-xs">saved.</p>
          )}
          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}

          {/* Save button */}
          <div>
            <button
              onClick={handleSave}
              disabled={saving || !settings.hasEmail}
              className="border border-green-700 hover:border-green-500 text-green-400 px-4 py-1.5 text-sm disabled:opacity-40 transition-colors"
            >
              {saving ? "[saving...]" : "[save settings]"}
            </button>
          </div>

          {/* Note */}
          <p className="text-green-900 text-xs">
            {"Digests are delivered once per day at your chosen time. Empty digests (no buddy away messages) are skipped."}
          </p>
        </div>
      </div>
    </div>
  );
}
