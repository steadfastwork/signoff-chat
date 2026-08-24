// Generates public/sounds/door-open.wav and door-slam.wav — synthesized but
// modeled on a real wooden door (stick-slip creak + latch; impact + resonance)
// so they read as "door", not "beep". Run: node scripts/gen-door-sounds.mjs
import fs from "node:fs";
import path from "node:path";

const SR = 44100;
const OUT = path.join(process.cwd(), "public", "sounds");

function writeWav(file, samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(file, buf);
  console.log("wrote", file, `${(buf.length / 1024).toFixed(1)}kb`);
}

const clampBuf = (len) => new Float32Array(Math.ceil(len * SR));
// simple one-pole state for pseudo-random (deterministic, no Math.random dependence on time)
let seed = 1337;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff * 2 - 1; };

// decaying sine partial
function partial(out, freq, t0, dur, amp, decay = 6, phase = 0) {
  const s0 = (t0 * SR) | 0, s1 = Math.min(out.length, ((t0 + dur) * SR) | 0);
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    out[i] += Math.sin(2 * Math.PI * freq * t + phase) * amp * Math.exp(-decay * t);
  }
}
// filtered noise burst (one-pole lowpass), with attack/decay envelope
function noise(out, t0, dur, cutoff, amp, decay = 8) {
  const s0 = (t0 * SR) | 0, s1 = Math.min(out.length, ((t0 + dur) * SR) | 0);
  const a = Math.exp(-2 * Math.PI * cutoff / SR);
  let lp = 0;
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    lp = a * lp + (1 - a) * rnd();
    out[i] += lp * amp * Math.exp(-decay * t);
  }
}

// ── DOOR OPEN: a slow wooden creak that rises, then the latch clicks ──────────
function doorOpen() {
  const out = clampBuf(1.0);
  // stick-slip creak: a train of short resonant chirps, pitch rising, irregular
  let t = 0.02;
  for (let k = 0; k < 26 && t < 0.72; k++) {
    const f = 150 + k * 22 + rnd() * 18;          // rising, jittered
    const dur = 0.05 + Math.abs(rnd()) * 0.04;
    const amp = 0.14 * (0.5 + 0.5 * (k / 26));      // swells as it opens
    partial(out, f, t, dur, amp, 22, rnd() * 6.28);
    partial(out, f * 2.01, t, dur, amp * 0.4, 26);  // wood overtone
    t += dur * (0.55 + Math.abs(rnd()) * 0.5);
  }
  // hinge body resonance underneath
  partial(out, 92, 0.05, 0.6, 0.05, 4);
  // latch click + soft settle
  noise(out, 0.74, 0.03, 4000, 0.35, 40);
  partial(out, 180, 0.75, 0.18, 0.12, 10);
  partial(out, 240, 0.75, 0.12, 0.06, 12);
  writeWav(path.join(OUT, "door-open.wav"), out);
}

// ── DOOR SLAM: quick swing, hard impact, wood ring, tiny rattle ───────────────
function doorSlam() {
  const out = clampBuf(0.7);
  // fast pre-slam air swing
  noise(out, 0, 0.12, 900, 0.10, 10);
  // IMPACT at t=0.12
  const ti = 0.12;
  noise(out, ti, 0.05, 2600, 0.6, 55);           // broadband smack
  partial(out, 70, ti, 0.35, 0.55, 7);            // deep thud
  partial(out, 120, ti, 0.3, 0.3, 9);             // wood body modes
  partial(out, 196, ti, 0.25, 0.18, 12);
  partial(out, 330, ti, 0.18, 0.1, 16);
  // frame rattle
  noise(out, ti + 0.08, 0.09, 600, 0.12, 18);
  partial(out, 150, ti + 0.1, 0.12, 0.06, 20);
  writeWav(path.join(OUT, "door-slam.wav"), out);
}

doorOpen();
doorSlam();
