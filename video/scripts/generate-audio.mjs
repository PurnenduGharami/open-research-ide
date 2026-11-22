import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import tl from "../src/timeline.json" with { type: "json" };

const SR = 48000;
const DURATION_S = tl.durationInFrames / tl.fps;
const NUM_SAMPLES = Math.round(SR * DURATION_S);
const L = new Float64Array(NUM_SAMPLES);
const R = new Float64Array(NUM_SAMPLES);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

const sceneMap = new Map(tl.scenes.map((s) => [s.id, s]));
const cueSec = (sceneId, frame) => {
  const s = sceneMap.get(sceneId);
  if (!s) throw new Error(`Unknown scene: ${sceneId}`);
  return (s.from + frame) / tl.fps;
};

const clampIdx = (i) => Math.max(0, Math.min(NUM_SAMPLES - 1, i));

// 1. Ambient evolving pad
{
  const freqs = [110, 164.81, 220, 277.18, 329.63];
  for (let n = 0; n < NUM_SAMPLES; n++) {
    const t = n / SR;
    const fadeIn = Math.min(1, t / 2.0);
    const fadeOut = Math.min(1, (DURATION_S - t) / 2.5);
    const env = fadeIn * fadeOut * 0.045;
    let sumL = 0;
    let sumR = 0;
    for (let i = 0; i < freqs.length; i++) {
      const f0 = freqs[i];
      const lfo = 0.55 + 0.45 * Math.sin(2 * Math.PI * 0.07 * t + i);
      const phL = 2 * Math.PI * f0 * t;
      const phR = 2 * Math.PI * (f0 + 0.15) * t;
      sumL += (Math.sin(phL) + 0.3 * Math.sin(2 * phL)) * lfo;
      sumR += (Math.sin(phR) + 0.3 * Math.sin(2 * phR)) * lfo;
    }
    L[n] += sumL * env;
    R[n] += sumR * env;
  }
}

// 2. Whoosh helper (one-pole lowpass noise sweep)
function addWhoosh(startSec, totalDur, attackDur, releaseDur, gain) {
  const startIdx = Math.round(startSec * SR);
  const len = Math.round(totalDur * SR);
  let lpL = 0;
  let lpR = 0;
  for (let k = 0; k < len; k++) {
    const idx = startIdx + k;
    if (idx < 0 || idx >= NUM_SAMPLES) continue;
    const dt = k / SR;
    const progress = Math.min(1, dt / Math.min(totalDur, 0.6));
    const fc = 300 + (4000 - 300) * progress;
    const a = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    const xL = rand() * 2 - 1;
    const xR = rand() * 2 - 1;
    lpL += a * (xL - lpL);
    lpR += a * (xR - lpR);
    let env = 1;
    if (dt < attackDur) {
      env = dt / attackDur;
    } else if (dt > totalDur - releaseDur) {
      env = Math.max(0, (totalDur - dt) / releaseDur);
    }
    const atk = Math.min(1, dt / 0.005);
    const amp = gain * env * atk;
    L[idx] += lpL * amp;
    R[idx] += lpR * amp;
  }
}

// 3. Sub drop helper
function addSubSweep(startSec, dur, fStart, fEnd, gain) {
  const startIdx = Math.round(startSec * SR);
  const len = Math.round(dur * SR);
  let phase = 0;
  for (let k = 0; k < len; k++) {
    const idx = startIdx + k;
    if (idx < 0 || idx >= NUM_SAMPLES) continue;
    const dt = k / SR;
    const x = dt / dur;
    const f = fStart + (fEnd - fStart) * x;
    phase += (2 * Math.PI * f) / SR;
    const atk = Math.min(1, dt / 0.005);
    const env = Math.sin(Math.PI * x) * atk * gain;
    const s = Math.sin(phase) * env;
    L[idx] += s;
    R[idx] += s;
  }
}

// 4. Tonal one-shot helper
function addTone(startSec, freqs, tau, gain, attackSec = 0.005) {
  const startIdx = Math.round(startSec * SR);
  const dur = Math.min(8, tau * 6 + attackSec);
  const len = Math.round(dur * SR);
  const weight = 1 / freqs.length;
  for (let k = 0; k < len; k++) {
    const idx = startIdx + k;
    if (idx < 0 || idx >= NUM_SAMPLES) continue;
    const dt = k / SR;
    const atk = Math.min(1, dt / attackSec);
    const env = atk * Math.exp(-dt / tau) * gain;
    let sum = 0;
    for (let i = 0; i < freqs.length; i++) {
      sum += Math.sin(2 * Math.PI * freqs[i] * dt) * weight;
    }
    L[idx] += sum * env;
    R[idx] += sum * env;
  }
}

// 5. Typing clicks
{
  const { scene, startFrame, framesPerChar, text } = tl.typing;
  const burstLen = Math.round(0.006 * SR);
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " ") continue;
    const tSec = cueSec(scene, startFrame + i * framesPerChar);
    const startIdx = Math.round(tSec * SR);
    const g = 0.07 * (0.8 + 0.4 * rand());
    const pan = (rand() * 2 - 1) * 0.3;
    const gL = g * (1 - pan * 0.5);
    const gR = g * (1 + pan * 0.5);
    let prev = 0;
    for (let k = 0; k < burstLen; k++) {
      const idx = startIdx + k;
      if (idx < 0 || idx >= NUM_SAMPLES) continue;
      const dt = k / SR;
      const x = rand() * 2 - 1;
      const diff = (x - prev) * 0.5;
      prev = x;
      const atk = Math.min(1, dt / 0.0005);
      const env = atk * Math.exp(-dt / 0.0015);
      L[idx] += diff * env * gL;
      R[idx] += diff * env * gR;
    }
  }
}

// 6. Cues
for (const cue of tl.cues) {
  const t = cueSec(cue.scene, cue.frame);
  switch (cue.type) {
    case "transition":
      addWhoosh(t, 0.65, 0.45, 0.2, 0.12);
      addSubSweep(t, 0.7, 50, 38, 0.22);
      break;
    case "tap":
      addTone(t, [880, 1320], 0.06, 0.08);
      break;
    case "snap":
      addTone(t, [1046.5, 1568], 0.25, 0.09);
      break;
    case "ping":
      addTone(t, [1318.5, 1975.5], 0.6, 0.07);
      addTone(t + 0.18, [1318.5, 1975.5], 0.6, 0.07 * 0.4);
      break;
    case "tick":
      addTone(t, [660], 0.08, 0.06);
      break;
    case "chime":
      addTone(t, [784, 1174.7], 0.4, 0.08);
      break;
    case "softWhoosh":
      addWhoosh(t, 0.3, 0.2, 0.1, 0.06);
      break;
    case "finaleChord": {
      const chordFreqs = [110, 220, 277.18, 329.63, 440];
      for (const f of chordFreqs) {
        addTone(t, [f], 4.0, 0.05, 0.05);
      }
      addTone(t, [55], 2.0, 0.14, 0.01);
      break;
    }
    default:
      throw new Error(`Unknown cue type: ${cue.type}`);
  }
}

// 7. Master fade-out, soft-clip, Int16 interleaved PCM
const dataSize = NUM_SAMPLES * 4;
const buf = Buffer.alloc(44 + dataSize);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + dataSize, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(dataSize, 40);

const tanhNorm = Math.tanh(1.2);
const fadeStartIdx = Math.round((DURATION_S - 1.5) * SR);
for (let n = 0; n < NUM_SAMPLES; n++) {
  const masterFade = n >= fadeStartIdx ? Math.max(0, (NUM_SAMPLES - n) / (1.5 * SR)) : 1;
  const sL = Math.tanh(1.2 * L[n] * masterFade) / tanhNorm;
  const sR = Math.tanh(1.2 * R[n] * masterFade) / tanhNorm;
  const iL = Math.max(-32768, Math.min(32767, Math.round(sL * 32767)));
  const iR = Math.max(-32768, Math.min(32767, Math.round(sR * 32767)));
  const off = 44 + n * 4;
  buf.writeInt16LE(iL, off);
  buf.writeInt16LE(iR, off + 2);
}

const outDir = resolve(import.meta.dirname, "../public");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "soundtrack.wav");
writeFileSync(outPath, buf);
console.log(`Generated ${outPath} (${DURATION_S.toFixed(1)}s, ${SR}Hz stereo, ${(buf.length / 1024 / 1024).toFixed(2)} MiB)`);
