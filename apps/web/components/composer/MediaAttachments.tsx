"use client";

import Image from "next/image";
import type { GifResult } from "./GiphyPicker";

export interface PendingMedia {
  url: string;
  type: "IMAGE" | "VIDEO";
}

interface MediaAttachmentsProps {
  media: PendingMedia[];
  gifs: GifResult[];
  onRemoveMedia: (index: number) => void;
  onRemoveGif: (index: number) => void;
}

export function MediaAttachments({
  media,
  gifs,
  onRemoveMedia,
  onRemoveGif,
}: MediaAttachmentsProps) {
  if (media.length === 0 && gifs.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 py-2 border-t" style={{ borderColor: "var(--border)" }}>
      {media.map((item, i) => (
        <div key={`media-${i}`} className="relative group rounded-lg overflow-hidden w-20 h-20 flex-shrink-0">
          {item.type === "VIDEO" ? (
            <video
              src={item.url}
              className="w-full h-full object-cover"
              muted
            />
          ) : (
            <Image
              src={item.url}
              alt="attachment"
              width={80}
              height={80}
              className="w-full h-full object-cover"
              unoptimized
            />
          )}
          <button
            type="button"
            onClick={() => onRemoveMedia(i)}
            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}

      {gifs.map((gif, i) => (
        <div key={`gif-${gif.id}`} className="relative group rounded-lg overflow-hidden w-20 h-20 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gif.previewUrl}
            alt={gif.title}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemoveGif(i)}
            className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
            title="Remove"
          >
            ×
          </button>
          <span
            className="absolute bottom-1 left-1 text-[8px] font-mono px-1 rounded"
            style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
          >
            GIF
          </span>
        </div>
      ))}
    </div>
  );
}
