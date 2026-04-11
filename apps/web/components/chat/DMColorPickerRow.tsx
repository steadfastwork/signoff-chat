"use client";

import { useState } from "react";
import { DM_COLOR_PALETTE, DM_FONT_SIZES, type DMColor, type DMFontSize } from "@/lib/dmColors";

// ---------------------------------------------------------------------------
// "A" button — shows current color bar underneath
// ---------------------------------------------------------------------------

interface AButtonProps {
  color: string;
  open: boolean;
  onClick: () => void;
}

function AButton({ color, open, onClick }: AButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title="Text color"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        width: 26,
        height: 26,
        borderRadius: 5,
        border: "none",
        cursor: "pointer",
        padding: 0,
        background: open ? "var(--card2, #1a1a18)" : hovered ? "rgba(255,255,255,0.05)" : "transparent",
        color: open ? "var(--text)" : "var(--text-muted)",
        flexShrink: 0,
        transition: "background 0.1s, color 0.1s",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1, fontFamily: "var(--font-dm-sans)" }}>A</span>
      {/* Color bar under the A */}
      <div
        style={{
          width: 10,
          height: 2,
          borderRadius: 1,
          background: color,
          flexShrink: 0,
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Color swatch
// ---------------------------------------------------------------------------

function Swatch({
  hex,
  active,
  onClick,
}: {
  hex: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      title={hex}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: active ? "2px solid #fff" : "2px solid transparent",
        background: hex,
        cursor: "pointer",
        padding: 0,
        transform: active ? "scale(1.15)" : hovered ? "scale(1.2)" : "scale(1)",
        transition: "transform 0.12s, border-color 0.12s",
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Size pill
// ---------------------------------------------------------------------------

function SizePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      style={{
        width: 24,
        height: 22,
        borderRadius: 4,
        border: active ? "1px solid #8a6010" : "1px solid var(--border2, #2c2820)",
        background: active ? "#1a1200" : "transparent",
        color: active ? "#c8860a" : "var(--text-muted)",
        fontSize: 11,
        fontWeight: active ? 700 : 400,
        fontFamily: "var(--font-dm-sans)",
        cursor: "pointer",
        padding: 0,
        transition: "background 0.1s, color 0.1s, border-color 0.1s",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// DMColorPickerRow
// ---------------------------------------------------------------------------

interface Props {
  color: DMColor | string;
  size: DMFontSize;
  onColorChange: (hex: DMColor) => void;
  onSizeChange: (size: DMFontSize) => void;
}

export function DMColorPickerRow({ color, size, onColorChange, onSizeChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* "A" button — sits in the toolbar row */}
      <AButton color={color} open={open} onClick={() => setOpen((v) => !v)} />

      {/* Picker row — slides in below on open */}
      <div
        style={{
          maxHeight: open ? 40 : 0,
          overflow: "hidden",
          transition: "max-height 0.2s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            paddingTop: 6,
            paddingBottom: 2,
            paddingLeft: 2,
            paddingRight: 2,
          }}
        >
          {/* Label — hidden on small screens */}
          <span
            className="hidden sm:inline"
            style={{ fontSize: 10, color: "var(--text-dim)", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            Text color:
          </span>

          {/* Color swatches */}
          {DM_COLOR_PALETTE.map((c) => (
            <Swatch
              key={c.hex}
              hex={c.hex}
              active={color === c.hex}
              onClick={() => onColorChange(c.hex as DMColor)}
            />
          ))}

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Font size pills */}
          <div style={{ display: "flex", gap: 3 }}>
            {(Object.entries(DM_FONT_SIZES) as [DMFontSize, { px: number; label: string }][]).map(
              ([key, val]) => (
                <SizePill
                  key={key}
                  label={val.label}
                  active={size === key}
                  onClick={() => onSizeChange(key)}
                />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
