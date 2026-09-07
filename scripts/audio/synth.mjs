/**
 * A tiny offline synthesis toolkit for the game's audio assets.
 *
 * Everything Quadro plays is generated here rather than licensed, so the whole
 * sound design is one reproducible script: run `node scripts/audio/build.mjs`
 * and `public/audio/` is rebuilt from source.
 */

export const SR = 44100;

/** A stereo buffer of `seconds` of silence. */
export function buffer(seconds) {
  const n = Math.ceil(seconds * SR);
  return { n, L: new Float32Array(n), R: new Float32Array(n) };
}

export function add(buf, i, l, r = l) {
  if (i < 0 || i >= buf.n) return;
  buf.L[i] += l;
  buf.R[i] += r;
}

/** Attack/decay/sustain/release envelope, evaluated at time `t` of `dur`. */
export function adsr(t, dur, { a = 0.005, d = 0.08, s = 0.6, r = 0.2 } = {}) {
  if (t < 0 || t > dur) return 0;
  const body = Math.max(0, dur - r);
  if (t < a) return t / a;
  if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
  if (t < body) return s;
  return s * Math.max(0, 1 - (t - body) / r);
}

export const sine = (p) => Math.sin(2 * Math.PI * p);
export const tri = (p) => 2 * Math.abs(2 * (p - Math.floor(p + 0.5))) - 1;
export const saw = (p) => 2 * (p - Math.floor(p + 0.5));
export const square = (p) => (p - Math.floor(p) < 0.5 ? 1 : -1);

/** Equal temperament; 69 = A4 = 440 Hz. */
export const note = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * Render one voice into `buf`.
 *
 * `freq` and `amp` may be numbers or functions of normalized time, which is how
 * the sweeps (bonus rise, penalty fall) are written.
 */
export function tone(buf, start, dur, opts = {}) {
  const {
    freq = 440,
    wave = sine,
    gain = 0.2,
    pan = 0,
    env = {},
    detune = 0,
    fm = null,
  } = opts;
  const i0 = Math.round(start * SR);
  const n = Math.round(dur * SR);
  const fFn = typeof freq === 'function' ? freq : () => freq;
  const gFn = typeof gain === 'function' ? gain : () => gain;
  const gl = Math.sqrt((1 - pan) / 2) * Math.SQRT2;
  const gr = Math.sqrt((1 + pan) / 2) * Math.SQRT2;
  let phase = 0;
  let phase2 = 0;
  for (let k = 0; k < n; k += 1) {
    const t = k / SR;
    const x = t / dur;
    const f = fFn(x, t);
    phase += f / SR;
    let s = wave(phase);
    if (detune) {
      phase2 += (f * Math.pow(2, detune / 1200)) / SR;
      s = (s + wave(phase2)) * 0.5;
    }
    if (fm) s = wave(phase + fm.index * sine((f * fm.ratio * t)));
    const v = s * adsr(t, dur, env) * gFn(x, t);
    add(buf, i0 + k, v * gl, v * gr);
  }
}

/** Band-limited-ish noise burst; `q` shapes it from hiss (0) to thump (1). */
export function noise(buf, start, dur, { gain = 0.2, env = {}, lp = 0.3, pan = 0 } = {}) {
  const i0 = Math.round(start * SR);
  const n = Math.round(dur * SR);
  const gl = Math.sqrt((1 - pan) / 2) * Math.SQRT2;
  const gr = Math.sqrt((1 + pan) / 2) * Math.SQRT2;
  let y = 0;
  for (let k = 0; k < n; k += 1) {
    const t = k / SR;
    y += lp * (Math.random() * 2 - 1 - y);
    const v = y * adsr(t, dur, env) * gain;
    add(buf, i0 + k, v * gl, v * gr);
  }
}

/** One-pole low-pass over the whole buffer, in place. */
export function lowpass(buf, hz) {
  const a = 1 - Math.exp((-2 * Math.PI * hz) / SR);
  let l = 0;
  let r = 0;
  for (let i = 0; i < buf.n; i += 1) {
    l += a * (buf.L[i] - l);
    r += a * (buf.R[i] - r);
    buf.L[i] = l;
    buf.R[i] = r;
  }
}

/**
 * A small Schroeder reverb — four combs into two allpasses.
 *
 * Not a convincing room, but enough air that the pads and chimes do not sound
 * like they were recorded inside a shoebox.
 */
export function reverb(buf, { mix = 0.25, decay = 0.78 } = {}) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491].map((d) => ({
    d: Math.round(d * 1.4),
    b: new Float32Array(Math.round(d * 1.4)),
    i: 0,
  }));
  const allpass = [556, 441].map((d) => ({ d, b: new Float32Array(d), i: 0 }));
  const out = { n: buf.n, L: new Float32Array(buf.n), R: new Float32Array(buf.n) };
  for (let ch = 0; ch < 2; ch += 1) {
    const src = ch ? buf.R : buf.L;
    const dst = ch ? out.R : out.L;
    for (const c of combs) c.b.fill(0);
    for (const a of allpass) a.b.fill(0);
    for (let i = 0; i < buf.n; i += 1) {
      let acc = 0;
      for (const c of combs) {
        const idx = (c.i + ch * 7) % c.d;
        const v = c.b[idx];
        c.b[idx] = src[i] + v * decay;
        c.i = (c.i + 1) % c.d;
        acc += v;
      }
      acc /= combs.length;
      for (const a of allpass) {
        const v = a.b[a.i];
        const y = -acc + v;
        a.b[a.i] = acc + v * 0.5;
        a.i = (a.i + 1) % a.d;
        acc = y;
      }
      dst[i] = acc;
    }
  }
  for (let i = 0; i < buf.n; i += 1) {
    buf.L[i] = buf.L[i] * (1 - mix) + out.L[i] * mix;
    buf.R[i] = buf.R[i] * (1 - mix) + out.R[i] * mix;
  }
}

/** Fold the buffer's tail back over its head so the loop has no seam. */
export function crossfadeLoop(buf, seconds) {
  const f = Math.round(seconds * SR);
  const n = buf.n - f;
  const out = { n, L: new Float32Array(n), R: new Float32Array(n) };
  out.L.set(buf.L.subarray(0, n));
  out.R.set(buf.R.subarray(0, n));
  for (let k = 0; k < f; k += 1) {
    const w = k / f;
    out.L[k] = out.L[k] * w + buf.L[n + k] * (1 - w);
    out.R[k] = out.R[k] * w + buf.R[n + k] * (1 - w);
  }
  return out;
}

export function normalize(buf, peak = 0.9) {
  let max = 0;
  for (let i = 0; i < buf.n; i += 1) {
    max = Math.max(max, Math.abs(buf.L[i]), Math.abs(buf.R[i]));
  }
  if (max === 0) return;
  const g = peak / max;
  for (let i = 0; i < buf.n; i += 1) {
    buf.L[i] *= g;
    buf.R[i] *= g;
  }
}

/** Trim clicks at the very edges of a one-shot. */
export function fadeEdges(buf, ms = 4) {
  const f = Math.round((ms / 1000) * SR);
  for (let k = 0; k < f && k < buf.n; k += 1) {
    const w = k / f;
    buf.L[k] *= w;
    buf.R[k] *= w;
    buf.L[buf.n - 1 - k] *= w;
    buf.R[buf.n - 1 - k] *= w;
  }
}

/** 16-bit stereo PCM WAV. */
export function toWav(buf) {
  const bytes = buf.n * 4;
  const out = Buffer.alloc(44 + bytes);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + bytes, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(bytes, 40);
  const clamp = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < buf.n; i += 1) {
    out.writeInt16LE(clamp(buf.L[i]), 44 + i * 4);
    out.writeInt16LE(clamp(buf.R[i]), 46 + i * 4);
  }
  return out;
}
