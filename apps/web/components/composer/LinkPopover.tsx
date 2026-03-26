"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

interface LinkPopoverProps {
  editor: Editor;
  onClose: () => void;
}

export function LinkPopover({ editor, onClose }: LinkPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentHref = editor.isActive("link")
    ? (editor.getAttributes("link").href as string) ?? ""
    : "";

  const [url, setUrl] = useState(currentHref);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

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

  const apply = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
    } else {
      // Auto-prepend https:// if no protocol
      const href =
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`;
      editor.chain().focus().setLink({ href }).run();
    }
    onClose();
  };

  const remove = () => {
    editor.chain().focus().unsetLink().run();
    onClose();
  };

  return (
    <div
      ref={containerRef}
      className="absolute z-50 bottom-full mb-1 left-0 rounded-xl border shadow-lg px-3 py-2 flex items-center gap-2"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        minWidth: 280,
        maxWidth: 400,
      }}
    >
      <input
        ref={inputRef}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); apply(); }
          if (e.key === "Escape") { e.preventDefault(); onClose(); }
        }}
        placeholder="https://…"
        className="flex-1 bg-transparent outline-none text-xs font-mono min-w-0"
        style={{ color: "var(--text)", caretColor: "var(--amber)" }}
      />
      <button
        type="button"
        onMouseDown={(e) => { e.preventDefault(); apply(); }}
        className="text-[11px] font-mono px-2 py-0.5 rounded"
        style={{ background: "var(--amber)", color: "#fff8e6" }}
      >
        set
      </button>
      {editor.isActive("link") && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); remove(); }}
          className="text-[11px] font-mono px-2 py-0.5 rounded"
          style={{
            background: "rgba(239,68,68,0.15)",
            color: "#ef4444",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          remove
        </button>
      )}
    </div>
  );
}
