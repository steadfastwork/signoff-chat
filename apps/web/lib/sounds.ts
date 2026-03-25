/**
 * Sound system using Web Audio API.
 *
 * HTMLAudioElement.play() called from setInterval/setTimeout can be blocked
 * by the browser's autoplay policy even after a user gesture. Web Audio API
 * with a persistent AudioContext stays unlocked once resumed via a user gesture.
 */

type SoundName = "message" | "buddy-online";

const SOUND_NAMES: SoundName[] = ["message", "buddy-online"];

let ctx: AudioContext | null = null;
const buffers: Partial<Record<SoundName, AudioBuffer>> = {};
let unlocked = false;

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return ctx;
}

async function loadBuffer(name: SoundName): Promise<void> {
  try {
    const context = getContext();
    const res = await fetch(`/sounds/${name}.wav`);
    if (!res.ok) return;
    const arrayBuffer = await res.arrayBuffer();
    buffers[name] = await context.decodeAudioData(arrayBuffer);
  } catch {
    // ignore
  }
}

/**
 * Call this once on any user gesture (click, keydown, etc.) to unlock the
 * AudioContext and preload all sound buffers.
 */
export async function unlockSounds(): Promise<void> {
  if (typeof window === "undefined") return;
  const context = getContext();
  if (context.state === "suspended") {
    await context.resume().catch(() => {});
  }
  // Load any buffers that haven't been loaded yet (retries on failure)
  const missing = SOUND_NAMES.filter((n) => !buffers[n]);
  if (missing.length > 0) {
    await Promise.all(missing.map(loadBuffer));
  }
  unlocked = true;
}

/**
 * Play a named sound. No-ops if the context hasn't been unlocked yet or the
 * buffer hasn't loaded. Resumes the AudioContext if it was auto-suspended.
 */
export function playSound(name: SoundName): void {
  if (typeof window === "undefined") return;
  const context = ctx;
  const buffer = buffers[name];
  if (!context || !buffer) return;

  const doPlay = () => {
    try {
      const source = context.createBufferSource();
      source.buffer = buffer;
      const gain = context.createGain();
      gain.gain.value = 0.5;
      source.connect(gain);
      gain.connect(context.destination);
      source.start(0);
    } catch {
      // ignore
    }
  };

  if (context.state === "suspended") {
    context.resume().then(doPlay).catch(() => {});
  } else {
    doPlay();
  }
}
