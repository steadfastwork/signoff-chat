"use client";
// SIGNOFF.CHAT — Retro "Online Messenger" UI kit
// Ported from handoff/retro-components.jsx. Inline styles match the approved mocks.
// Brand/mono fonts resolve through the next/font CSS variables loaded in app/layout.tsx.
// The retro color tokens are mirrored into tailwind.config.ts under theme.extend.colors.retro.

import React, { useRef, useState, useEffect, type CSSProperties, type ReactNode } from "react";

// ---------------------------------------------------------------------------
// Theme tokens (from the approved design)
// ---------------------------------------------------------------------------
export const retro = {
  desktop: "#3f4778", // desktop / page background
  desktopDot: "rgba(205,215,255,0.09)",
  paper: "#f6f4ee", // window body
  chrome: "#fdfcf9", // titlebars, buttons
  border: "#8f8c82", // window outline
  hairline: "#e2dfd6", // inner separators
  inputBorder: "#a9b4cf",
  well: "#fff", // message wells / lists
  wellBorder: "#d5d2c8",
  ink: "#26262b",
  inkSoft: "#4a4a52",
  inkMuted: "#9a978e",
  blue: "#3a44b5", // links, own-brand blue
  blueBright: "#4a5cc4",
  gradient: "linear-gradient(160deg,#4a5cc4,#3a4699)", // brand plaque
  gold: "#f2cf5b",
  goldDim: "#c9a030",
  green: "#4caf7d",
  greenDeep: "#2c7a52",
  amber: "#dca24e",
  amberDeep: "#8a6420",
  red: "#b05050",
  redDeep: "#a04a3a",
  selection: "#faf0c8", // buddy row highlight
  awayBanner: "#fbf3d2",
  awayBorder: "#dcc27a",
  // Brand + mono resolve via next/font variables (see app/layout.tsx); UI + message are system fonts.
  fontUI: "Tahoma,Verdana,'Segoe UI',sans-serif",
  fontMsg: "Georgia,'Times New Roman',serif",
  fontMono: "var(--font-ibm-plex-mono),'IBM Plex Mono',monospace",
  fontBrand: "var(--font-vt323),'VT323',monospace",
  // screen-name palette (assign per user, deterministic by hash)
  snColors: ["#3a44b5", "#7a4a9c", "#1a7a7a", "#8a6420", "#b05050", "#2c7a52"],
} as const;

export const snColor = (screenname: string): string => {
  let h = 0;
  for (let i = 0; i < screenname.length; i++) h = (h * 31 + screenname.charCodeAt(i)) >>> 0;
  return retro.snColors[h % retro.snColors.length];
};

// ---------------------------------------------------------------------------
// Sound engine (WebAudio, no assets) — door open/slam + message chimes
// ---------------------------------------------------------------------------
let _ctx: AudioContext | undefined;
const ctx = (): AudioContext =>
  (_ctx ||= new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)());

const sweep = (
  f0: number,
  f1: number,
  t0: number,
  dur: number,
  type: OscillatorType = "sine",
  vol = 0.05,
): void => {
  try {
    const a = ctx(),
      o = a.createOscillator(),
      g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, a.currentTime + t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), a.currentTime + t0 + dur);
    g.gain.setValueAtTime(vol, a.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(0.0008, a.currentTime + t0 + dur);
    o.connect(g);
    g.connect(a.destination);
    o.start(a.currentTime + t0);
    o.stop(a.currentTime + t0 + dur + 0.02);
  } catch {
    /* audio not available */
  }
};

const noiseBurst = (t0: number, dur: number, lp: number, vol: number): void => {
  try {
    const a = ctx(),
      len = Math.max(1, Math.ceil(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate),
      d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const f = a.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lp;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, a.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(0.0008, a.currentTime + t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(a.destination);
    src.start(a.currentTime + t0);
  } catch {
    /* audio not available */
  }
};

export const sounds = {
  msgIn: () => {
    sweep(660, 660, 0, 0.09, "sine", 0.09);
    sweep(1046, 1046, 0.09, 0.22, "sine", 0.09);
    sweep(2092, 2092, 0.09, 0.12, "sine", 0.02);
  },
  msgOut: () => {
    sweep(880, 880, 0, 0.07, "sine", 0.06);
    sweep(587, 587, 0.07, 0.16, "sine", 0.06);
  },
  doorOpen: () => {
    noiseBurst(0, 0.05, 2200, 0.05);
    for (let k = 0; k < 7; k++) sweep(85 + k * 16, 105 + k * 16, 0.05 + k * 0.075, 0.11, "sawtooth", 0.028);
    sweep(500, 700, 0.62, 0.05, "triangle", 0.03);
  },
  doorSlam: () => {
    sweep(150, 48, 0, 0.28, "sine", 0.22);
    noiseBurst(0, 0.16, 750, 0.22);
    noiseBurst(0.1, 0.12, 420, 0.09);
    sweep(95, 40, 0.09, 0.2, "triangle", 0.08);
  },
  tick: () => sweep(780, 780, 0, 0.1, "triangle", 0.04),
};

// ---------------------------------------------------------------------------
// RetroWindow — the shared window chrome (titlebar + paper body)
// ---------------------------------------------------------------------------
export interface RetroWindowProps {
  title: string;
  badge?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  children?: ReactNode;
  width?: number | string;
  style?: CSSProperties;
}

export function RetroWindow({ title, badge = false, onClose, onBack, children, width, style }: RetroWindowProps) {
  return (
    <div
      style={{
        width,
        maxWidth: "100%", // never overflow narrow / mobile viewports
        boxSizing: "border-box",
        background: retro.paper,
        border: `1px solid ${retro.border}`,
        borderRadius: 4,
        boxShadow: "0 18px 44px rgba(10,15,40,0.45)",
        display: "flex",
        flexDirection: "column",
        fontFamily: retro.fontUI,
        ...style,
      }}
    >
      <div
        style={{
          background: retro.chrome,
          color: retro.ink,
          fontWeight: "bold",
          fontSize: 13,
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: 7,
          borderBottom: `1px solid ${retro.hairline}`,
          borderRadius: "4px 4px 0 0",
          userSelect: "none",
        }}
      >
        {onBack && (
          <button onClick={onBack} style={{ ...btnStyle, width: 38, height: 30, fontSize: 16 }}>
            ‹
          </button>
        )}
        {badge && (
          <span
            style={{
              fontFamily: retro.fontBrand,
              fontSize: 15,
              background: "#4356c0",
              color: retro.gold,
              padding: "1px 4px",
              lineHeight: 1.1,
              borderRadius: 2,
            }}
          >
            S/C
          </span>
        )}
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
        {onClose && (
          <span onClick={onClose} style={{ color: retro.inkMuted, fontSize: 12, padding: "2px 5px", cursor: "pointer" }}>
            ✕
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export const btnStyle: CSSProperties = {
  background: retro.chrome,
  border: `1px solid #c9c6bc`,
  borderRadius: 3,
  fontSize: 12,
  fontWeight: "bold",
  color: retro.inkSoft,
  cursor: "pointer",
  fontFamily: retro.fontUI,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

export const wellStyle: CSSProperties = {
  background: retro.well,
  border: `1px solid ${retro.wellBorder}`,
  borderRadius: 2,
  overflowY: "auto",
};

export const inputStyle: CSSProperties = {
  border: `1px solid ${retro.inputBorder}`,
  borderRadius: 3,
  fontSize: 14,
  background: "#fff",
  outline: "none",
  color: retro.ink,
  caretColor: retro.ink,
  padding: "0 10px",
  fontFamily: retro.fontUI,
};

// ---------------------------------------------------------------------------
// PresenceStrip — trust/presence line under a DM titlebar.
// (Encryption was removed from the product; this replaces the old EncryptionStrip.)
// ---------------------------------------------------------------------------
export interface PresenceStripProps {
  label?: string;
  trusted?: boolean;
  onProfile?: () => void;
}

export function PresenceStrip({ label = "direct message", trusted = true, onProfile }: PresenceStripProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        fontSize: 10.5,
        color: "#5a574e",
        borderBottom: `1px solid ${retro.hairline}`,
        background: "#faf8f3",
        fontFamily: retro.fontUI,
      }}
    >
      <span aria-hidden style={{ fontSize: 11 }}>
        ●
      </span>
      <span style={{ fontFamily: retro.fontMono }}>{label}</span>
      <span style={{ flex: 1 }} />
      <span>presence:</span>
      <span
        style={{
          width: 56,
          height: 7,
          border: "1px solid #c9c6bc",
          borderRadius: 2,
          background: trusted
            ? `repeating-linear-gradient(90deg,${retro.green} 0 5px,${retro.paper} 5px 7px)`
            : retro.paper,
        }}
      />
      {onProfile && (
        <span
          onClick={onProfile}
          style={{ color: retro.blue, textDecoration: "underline", cursor: "pointer", padding: "4px 0 4px 4px" }}
        >
          profile
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageLog — AIM-style "name: text" lines with per-message formatting
// ---------------------------------------------------------------------------
export interface RetroMessageFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
}

export interface RetroMessage {
  screenname: string;
  text: string;
  time?: string;
  sys?: string;
  auto?: boolean;
  format?: RetroMessageFormat;
}

export function MessageLog({ messages, me, height = 220 }: { messages: RetroMessage[]; me: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages]);
  return (
    <div ref={ref} style={{ ...wellStyle, height, padding: "6px 0" }}>
      {messages.map((m, i) =>
        m.sys ? (
          <div
            key={i}
            style={{ padding: "3px 12px", fontSize: 10.5, color: retro.inkMuted, fontFamily: retro.fontMono, textAlign: "center" }}
          >
            {m.sys}
          </div>
        ) : (
          <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "2px 12px" }}>
            <div style={{ flex: 1, minWidth: 0, fontFamily: retro.fontMsg, fontSize: 13.5 }}>
              <span
                style={{
                  fontWeight: "bold",
                  fontStyle: m.auto ? "italic" : "normal",
                  color: m.screenname === me ? retro.red : snColor(m.screenname),
                }}
              >
                {m.auto ? `Auto response from ${m.screenname}:` : `${m.screenname}:`}
              </span>{" "}
              <span
                style={{
                  color: m.format?.color || retro.ink,
                  fontWeight: m.format?.bold ? "bold" : "normal",
                  fontStyle: m.format?.italic ? "italic" : "normal",
                  textDecoration: m.format?.underline ? "underline" : "none",
                }}
              >
                {m.text}
              </span>
            </div>
            {m.time && (
              <span style={{ fontSize: 9.5, color: "#b5b2a8", fontFamily: retro.fontMono, whiteSpace: "nowrap" }}>{m.time}</span>
            )}
          </div>
        ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormatToolbar — B / I / U + color swatches + smiley
// ---------------------------------------------------------------------------
export function FormatToolbar({
  format,
  onChange,
  onSmiley,
}: {
  format: RetroMessageFormat;
  onChange: (f: RetroMessageFormat) => void;
  onSmiley?: () => void;
}) {
  const t = (k: keyof RetroMessageFormat) => () => onChange({ ...format, [k]: !format[k] });
  const box = (active?: boolean): CSSProperties => ({
    ...btnStyle,
    width: 30,
    height: 28,
    fontFamily: retro.fontMsg,
    fontSize: 13,
    ...(active ? { background: "#eef0fb", border: `1px solid ${retro.blueBright}`, color: retro.blue } : {}),
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <button onClick={t("bold")} style={{ ...box(format.bold), fontWeight: "bold" }}>
        B
      </button>
      <button onClick={t("italic")} style={{ ...box(format.italic), fontStyle: "italic" }}>
        I
      </button>
      <button onClick={t("underline")} style={{ ...box(format.underline), textDecoration: "underline" }}>
        U
      </button>
      <span style={{ width: 1, height: 20, background: retro.wellBorder, margin: "0 2px" }} />
      {["#26262b", "#b05050", "#3a44b5", "#2c7a52", "#7a4a9c"].map((c) => (
        <span
          key={c}
          onClick={() => onChange({ ...format, color: c })}
          style={{
            width: 20,
            height: 20,
            borderRadius: 3,
            background: c,
            border: "1px solid rgba(0,0,0,0.25)",
            cursor: "pointer",
            outline: format.color === c ? `2px solid ${retro.blueBright}` : "none",
            outlineOffset: 1,
          }}
        />
      ))}
      <span style={{ flex: 1 }} />
      {onSmiley && (
        <button onClick={onSmiley} style={{ ...btnStyle, width: 30, height: 28, color: retro.amberDeep, fontSize: 14 }}>
          ☺
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SendButton — italic Send over the little status-gradient meter
// ---------------------------------------------------------------------------
export function SendButton({ onClick, width = 66 }: { onClick: () => void; width?: number }) {
  return (
    <button onClick={onClick} style={{ ...btnStyle, width, flexDirection: "column", gap: 3, padding: "6px 0" }}>
      <span style={{ fontWeight: "bold", fontSize: 12, fontStyle: "italic", color: retro.ink, fontFamily: retro.fontMsg }}>
        Send
      </span>
      <span
        style={{
          width: width - 22,
          height: 4,
          borderRadius: 2,
          opacity: 0.8,
          background: `linear-gradient(90deg,${retro.green} 0 45%,#d9c95e 45% 70%,${retro.amber} 70% 88%,#c96a5a 88% 100%)`,
        }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// BuddyRow — status dot + colored screenname (+ gold star / away tag)
// ---------------------------------------------------------------------------
export interface RetroBuddy {
  screenname: string;
  status: "ONLINE" | "AWAY" | "IDLE" | "INVISIBLE" | "OFFLINE";
  isGoldMember?: boolean;
}

export function BuddyRow({ buddy, selected, onClick }: { buddy: RetroBuddy; selected?: boolean; onClick?: () => void }) {
  const off = buddy.status === "OFFLINE" || buddy.status === "INVISIBLE";
  const away = buddy.status === "AWAY";
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 30,
        padding: "0 10px 0 26px",
        cursor: "pointer",
        background: selected ? retro.selection : "transparent",
        fontFamily: retro.fontUI,
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: off ? "transparent" : away ? retro.amber : retro.green,
          border: `1px solid ${off ? "#c9c6bc" : "transparent"}`,
        }}
      />
      <span
        style={{
          fontSize: 13.5,
          ...(off ? { color: "#b5b2a8", fontStyle: "italic" } : { color: snColor(buddy.screenname), fontWeight: "bold" }),
        }}
      >
        {buddy.screenname}
      </span>
      {buddy.isGoldMember && <span style={{ color: retro.goldDim, fontSize: 12 }}>★</span>}
      {away && <span style={{ fontSize: 10, fontStyle: "italic", color: "#b08020", marginLeft: "auto" }}>away</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AwayBanner + %n/%d/%t substitution helper
// ---------------------------------------------------------------------------
export const subSpecials = (text: string, buddyName: string): string => {
  const d = new Date();
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return text.split("%n").join(buddyName).split("%t").join(t).split("%d").join(`${d.getMonth() + 1}/${d.getDate()}`);
};

export function AwayBanner({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div
      style={{
        padding: "7px 9px",
        background: retro.awayBanner,
        border: `1px solid ${retro.awayBorder}`,
        borderRadius: 3,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          flex: 1,
          fontSize: 12,
          fontStyle: "italic",
          color: "#7a6320",
          fontFamily: retro.fontMsg,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        away: {message}
      </span>
      <button onClick={onBack} style={{ ...btnStyle, height: 28, padding: "0 10px", fontSize: 11 }}>
        I&apos;m Back
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DMWindow — self-contained composition (wire to the live API in Phase 5)
// ---------------------------------------------------------------------------
export function DMWindow({
  buddy,
  me,
  messages,
  onSend,
  onClose,
  onProfile,
}: {
  buddy: RetroBuddy;
  me: string;
  messages: RetroMessage[];
  onSend: (m: { text: string; format: RetroMessageFormat }) => void;
  onClose?: () => void;
  onProfile?: () => void;
}) {
  const [text, setText] = useState("");
  const [format, setFormat] = useState<RetroMessageFormat>({ bold: false, italic: false, underline: false, color: retro.ink });
  const send = () => {
    if (!text.trim()) return;
    onSend({ text: text.trim(), format });
    sounds.msgOut();
    setText("");
  };
  return (
    <RetroWindow title={`${buddy.screenname} — Direct Message`} onClose={onClose} width={440}>
      <PresenceStrip onProfile={onProfile} />
      <div style={{ margin: "8px 10px" }}>
        <MessageLog messages={messages} me={me} />
      </div>
      <div style={{ padding: "0 10px 6px" }}>
        <FormatToolbar format={format} onChange={setFormat} onSmiley={() => setText(text + " :-)")} />
      </div>
      <div style={{ display: "flex", gap: 7, padding: "0 10px 10px" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`message ${buddy.screenname}…`}
          style={{ ...inputStyle, flex: 1, minWidth: 0, height: 38 }}
        />
        <SendButton onClick={send} />
      </div>
    </RetroWindow>
  );
}
