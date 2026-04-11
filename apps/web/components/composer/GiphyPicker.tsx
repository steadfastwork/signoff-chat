"use client";

import { useEffect, useRef, useState } from "react";

export interface GifResult {
  id: string;
  url: string;
  previewUrl: string;
  width: number;
  height: number;
  title: string;
}

async function fetchGifs(type: "trending" | "search", q?: string): Promise<GifResult[]> {
  const params = new URLSearchParams({ type, limit: "24" });
  if (type === "search" && q) params.set("q", q);
  const res = await fetch(`/api/giphy?${params}`);
  if (!res.ok) throw new Error("giphy fetch failed");
  const data = await res.json();
  return data.gifs ?? [];
}

interface GiphyPickerProps {
  onSelect: (gif: GifResult) => void;
  onClose: () => void;
}

export function GiphyPicker({ onSelect, onClose }: GiphyPickerProps) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load trending on mount
  useEffect(() => {
    setLoading(true);
    setApiError(null);
    fetchGifs("trending")
      .then(setGifs)
      .catch(() => {
        setApiError("could not load GIFs");
        setGifs([]);
      })
      .finally(() => setLoading(false));
    inputRef.current?.focus();
  }, []);

  // Search on query change (debounced)
  useEffect(() => {
    const type = query.trim() ? "search" : "trending";
    const timer = setTimeout(() => {
      setLoading(true);
      setApiError(null);
      fetchGifs(type, query.trim() || undefined)
        .then(setGifs)
        .catch(() => {
          setApiError("could not load GIFs");
          setGifs([]);
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl border shadow-xl overflow-hidden"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        maxHeight: 340,
      }}
    >
      {/* Search bar */}
      <div className="p-2 border-b" style={{ borderColor: "var(--border)" }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="search GIFs…"
          className="w-full bg-transparent outline-none text-xs font-mono px-1"
          style={{ color: "var(--text)", caretColor: "var(--amber)" }}
        />
      </div>

      {/* GIF grid */}
      <div className="overflow-y-auto p-2" style={{ maxHeight: 284 }}>
        {loading ? (
          <p className="text-center text-[11px] font-mono py-8" style={{ color: "var(--text-dim)" }}>
            loading…
          </p>
        ) : apiError ? (
          <p className="text-center text-[11px] font-mono py-8 px-4" style={{ color: "#ef4444" }}>
            {apiError}
          </p>
        ) : gifs.length === 0 ? (
          <p className="text-center text-[11px] font-mono py-8" style={{ color: "var(--text-dim)" }}>
            no GIFs found
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => {
                  onSelect(gif);
                  onClose();
                }}
                className="rounded-lg overflow-hidden aspect-square hover:ring-2 focus:outline-none focus:ring-2 transition-all"
                style={{ ringColor: "var(--amber)" } as React.CSSProperties}
                title={gif.title}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-[9px] font-mono mt-2" style={{ color: "var(--text-dim)" }}>
          Powered by GIPHY
        </p>
      </div>
    </div>
  );
}
