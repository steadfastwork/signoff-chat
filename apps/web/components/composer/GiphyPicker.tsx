"use client";

import { useEffect, useRef, useState } from "react";
import { GiphyFetch } from "@giphy/js-fetch-api";
import type IGif from "@giphy/js-types/dist/gif";

const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY ?? "");

export interface GifResult {
  id: string;
  url: string;          // original/downsized CDN URL
  previewUrl: string;   // fixed_width_small preview
  width: number;
  height: number;
  title: string;
}

function toGifResult(gif: IGif): GifResult {
  const orig = gif.images.original;
  const preview = gif.images.fixed_width_small ?? gif.images.fixed_width;
  return {
    id: String(gif.id),
    url: orig.url,
    previewUrl: preview.url ?? orig.url,
    width: Number(orig.width),
    height: Number(orig.height),
    title: gif.title ?? "",
  };
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
    gf.trending({ limit: 24 })
      .then((res) => setGifs(res.data.map(toGifResult)))
      .catch((err) => {
        console.error("[GiphyPicker] trending failed:", err);
        setApiError("could not load GIFs — check NEXT_PUBLIC_GIPHY_API_KEY");
        setGifs([]);
      })
      .finally(() => setLoading(false));
    inputRef.current?.focus();
  }, []);

  // Search on query change (debounced)
  useEffect(() => {
    if (!query.trim()) {
      // Back to trending
      setLoading(true);
      setApiError(null);
      gf.trending({ limit: 24 })
        .then((res) => setGifs(res.data.map(toGifResult)))
        .catch((err) => {
          console.error("[GiphyPicker] trending failed:", err);
          setApiError("could not load GIFs — check NEXT_PUBLIC_GIPHY_API_KEY");
          setGifs([]);
        })
        .finally(() => setLoading(false));
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      setApiError(null);
      gf.search(query, { limit: 24 })
        .then((res) => setGifs(res.data.map(toGifResult)))
        .catch((err) => {
          console.error("[GiphyPicker] search failed:", err);
          setApiError("could not load GIFs — check NEXT_PUBLIC_GIPHY_API_KEY");
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
      <div
        className="overflow-y-auto p-2"
        style={{ maxHeight: 284 }}
      >
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

        {/* Giphy attribution */}
        <p className="text-center text-[9px] font-mono mt-2" style={{ color: "var(--text-dim)" }}>
          Powered by GIPHY
        </p>
      </div>
    </div>
  );
}
