/**
 * Retro sound pack system using Web Audio API synthesis.
 * No audio files needed — all sounds are generated programmatically.
 *
 * Packs: "classic" (AIM-style), "retro" (8-bit), "minimal" (subtle), "off"
 * Events: message_received, message_sent, buddy_online, buddy_offline, notification, nudge
 */

export type SoundPack = "classic" | "retro" | "minimal" | "off";
export type SoundEvent =
  | "message_received"
  | "message_sent"
  | "buddy_online"
  | "buddy_offline"
  | "notification"
  | "nudge";

// ---------------------------------------------------------------------------
// AudioContext singleton
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Primitive builders
// ---------------------------------------------------------------------------

function tone(
  ac: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
  freqEnd?: number
) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(freqEnd, startTime + duration);
  }

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

// ---------------------------------------------------------------------------
// Classic pack — AIM-inspired sine wave tones
// ---------------------------------------------------------------------------

const classic: Record<SoundEvent, (ac: AudioContext) => void> = {
  message_received(ac) {
    const t = ac.currentTime;
    tone(ac, 440, t,       0.12, 0.15);
    tone(ac, 660, t + 0.1, 0.18, 0.20);
  },
  message_sent(ac) {
    tone(ac, 880, ac.currentTime, 0.06, 0.06);
  },
  buddy_online(ac) {
    const t = ac.currentTime;
    const notes = [330, 415, 523, 659];
    notes.forEach((f, i) => tone(ac, f, t + i * 0.09, 0.12, 0.14));
  },
  buddy_offline(ac) {
    const t = ac.currentTime;
    const notes = [659, 523, 415, 330];
    notes.forEach((f, i) => tone(ac, f, t + i * 0.09, 0.12, 0.10));
  },
  notification(ac) {
    tone(ac, 880, ac.currentTime, 0.35, 0.18);
  },
  nudge(ac) {
    const t = ac.currentTime;
    for (let i = 0; i < 5; i++) {
      tone(ac, 440, t + i * 0.07, 0.05, 0.15);
    }
  },
};

// ---------------------------------------------------------------------------
// Retro pack — 8-bit square wave chiptune
// ---------------------------------------------------------------------------

const retro: Record<SoundEvent, (ac: AudioContext) => void> = {
  message_received(ac) {
    const t = ac.currentTime;
    tone(ac, 220, t,       0.08, 0.18, "square");
    tone(ac, 440, t + 0.09, 0.12, 0.18, "square");
  },
  message_sent(ac) {
    tone(ac, 880, ac.currentTime, 0.04, 0.10, "square");
  },
  buddy_online(ac) {
    const t = ac.currentTime;
    const notes = [262, 330, 392, 523];
    notes.forEach((f, i) => tone(ac, f, t + i * 0.07, 0.08, 0.15, "square"));
  },
  buddy_offline(ac) {
    const t = ac.currentTime;
    const notes = [523, 392, 330, 262];
    notes.forEach((f, i) => tone(ac, f, t + i * 0.07, 0.08, 0.10, "square"));
  },
  notification(ac) {
    // Coin sound — glide up
    tone(ac, 660, ac.currentTime, 0.08, 0.18, "square", 1320);
  },
  nudge(ac) {
    const t = ac.currentTime;
    for (let i = 0; i < 6; i++) {
      tone(ac, 160, t + i * 0.05, 0.04, 0.20, "square");
    }
  },
};

// ---------------------------------------------------------------------------
// Minimal pack — quiet triangle waves
// ---------------------------------------------------------------------------

const minimal: Record<SoundEvent, (ac: AudioContext) => void> = {
  message_received(ac) {
    tone(ac, 528, ac.currentTime, 0.15, 0.06, "triangle");
  },
  message_sent(ac) {
    tone(ac, 660, ac.currentTime, 0.05, 0.03, "triangle");
  },
  buddy_online(ac) {
    const t = ac.currentTime;
    tone(ac, 440, t,       0.10, 0.05, "triangle");
    tone(ac, 660, t + 0.12, 0.14, 0.06, "triangle");
  },
  buddy_offline(ac) {
    const t = ac.currentTime;
    tone(ac, 660, t,       0.10, 0.05, "triangle");
    tone(ac, 440, t + 0.12, 0.14, 0.04, "triangle");
  },
  notification(ac) {
    tone(ac, 880, ac.currentTime, 0.20, 0.06, "triangle");
  },
  nudge(ac) {
    const t = ac.currentTime;
    tone(ac, 440, t,        0.08, 0.06, "triangle");
    tone(ac, 440, t + 0.12, 0.08, 0.06, "triangle");
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const PACKS: Record<Exclude<SoundPack, "off">, Record<SoundEvent, (ac: AudioContext) => void>> = {
  classic,
  retro,
  minimal,
};

export function getSoundPack(): SoundPack {
  if (typeof window === "undefined") return "off";
  return (localStorage.getItem("sc-sound-pack") as SoundPack | null) ?? "off";
}

export function setSoundPack(pack: SoundPack) {
  if (typeof window === "undefined") return;
  localStorage.setItem("sc-sound-pack", pack);
}

export function playSound(event: SoundEvent) {
  const pack = getSoundPack();
  if (pack === "off") return;
  const ac = getCtx();
  if (!ac) return;
  try {
    PACKS[pack][event](ac);
  } catch {
    // AudioContext may be blocked — fail silently
  }
}

export function previewSound(pack: SoundPack, event: SoundEvent = "message_received") {
  if (pack === "off") return;
  const ac = getCtx();
  if (!ac) return;
  try {
    PACKS[pack][event](ac);
  } catch {}
}

/**
 * No-op kept for call-site compatibility. The new synthesis-based system
 * does not require pre-loading; AudioContext unlocks on first user gesture.
 */
export function unlockSounds(): void {
  getCtx();
}
