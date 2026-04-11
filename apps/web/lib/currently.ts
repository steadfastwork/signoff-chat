// ---------------------------------------------------------------------------
// "Currently" feature — shared types and constants
// ---------------------------------------------------------------------------

export const CURRENTLY_KEYS = [
  "listening",
  "reading",
  "watching",
  "playing",
  "making",
  "craving",
] as const;

export type CurrentlyKey = (typeof CURRENTLY_KEYS)[number];

export type CurrentlyData = Partial<Record<CurrentlyKey, string>>;

export const CURRENTLY_META: Record<
  CurrentlyKey,
  { label: string; emoji: string; placeholder: string }
> = {
  listening: { label: "listening", emoji: "🎵", placeholder: "listening to…" },
  reading:   { label: "reading",   emoji: "📖", placeholder: "reading…" },
  watching:  { label: "watching",  emoji: "📺", placeholder: "watching…" },
  playing:   { label: "playing",   emoji: "🎮", placeholder: "playing…" },
  making:    { label: "making",    emoji: "🛠",  placeholder: "making…" },
  craving:   { label: "craving",   emoji: "✦",  placeholder: "craving…" },
};

export const CURRENTLY_MAX_CHARS = 60;

/** Parse raw DB value (Json column) into a clean CurrentlyData object. */
export function parseCurrently(raw: unknown): CurrentlyData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: CurrentlyData = {};
  for (const key of CURRENTLY_KEYS) {
    const val = (raw as Record<string, unknown>)[key];
    if (typeof val === "string" && val.trim()) {
      result[key] = val.trim().slice(0, CURRENTLY_MAX_CHARS);
    }
  }
  return result;
}

/** Returns true if at least one field is filled. */
export function hasCurrently(c: CurrentlyData | null | undefined): boolean {
  if (!c) return false;
  return CURRENTLY_KEYS.some((k) => !!c[k]);
}

/** Returns filled fields as an array of [key, value] pairs. */
export function filledFields(c: CurrentlyData): [CurrentlyKey, string][] {
  return CURRENTLY_KEYS.filter((k) => !!c[k]).map((k) => [k, c[k]!]);
}
