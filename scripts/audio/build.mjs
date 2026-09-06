/**
 * Builds every audio asset the game ships with.
 *
 *   node scripts/audio/build.mjs
 *
 * Writes `public/audio/sfx/*.mp3` and `public/audio/music/*.mp3`. The generated
 * files are committed, so this only needs re-running when the sound design
 * changes. Requires ffmpeg on PATH for the mp3 encode.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SR,
  buffer,
  crossfadeLoop,
  fadeEdges,
  lowpass,
  noise,
  normalize,
  note,
  reverb,
  saw,
  sine,
  toWav,
  tone,
  tri,
} from './synth.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'public', 'audio');
const tmpDir = join(root, 'node_modules', '.cache', 'nodra-audio');

// ---- one-shots -------------------------------------------------------

/** A tile leaving a display: a short, dry, wooden tick. */
function select() {
  const b = buffer(0.16);
  noise(b, 0, 0.05, { gain: 0.35, lp: 0.55, env: { a: 0.001, d: 0.02, s: 0.15, r: 0.03 } });
  tone(b, 0, 0.12, {
    freq: (x) => 900 - 260 * x,
    wave: tri,
    gain: 0.3,
    env: { a: 0.001, d: 0.04, s: 0.2, r: 0.07 },
  });
  return b;
}

/** A tile landing on a staging row: the same tick with a body under it. */
function place() {
  const b = buffer(0.3);
  noise(b, 0, 0.06, { gain: 0.3, lp: 0.35, env: { a: 0.001, d: 0.03, s: 0.1, r: 0.03 } });
  tone(b, 0, 0.24, {
    freq: (x) => 320 - 130 * x,
    wave: sine,
    gain: 0.5,
    env: { a: 0.002, d: 0.07, s: 0.35, r: 0.15 },
  });
  tone(b, 0.005, 0.14, { freq: 640, wave: tri, gain: 0.14, env: { a: 0.001, d: 0.05, s: 0.1, r: 0.08 } });
  return b;
}

/** An illegal tap. Short and low enough not to feel like a scolding. */
function invalid() {
  const b = buffer(0.22);
  tone(b, 0, 0.18, {
    freq: (x) => 190 - 40 * x,
    wave: (p) => saw(p) * 0.5 + sine(p) * 0.5,
    gain: 0.28,
    env: { a: 0.004, d: 0.05, s: 0.5, r: 0.1 },
  });
  return b;
}

/** A tile scoring on the wall: a clean bell struck once. */
function score() {
  const b = buffer(0.9);
  const f = note(88); // E6
  for (const [ratio, gain, dur] of [
    [1, 0.32, 0.8],
    [2.01, 0.16, 0.55],
    [3.02, 0.08, 0.35],
    [4.98, 0.04, 0.25],
  ]) {
    tone(b, 0, dur, {
      freq: f * ratio,
      gain,
      env: { a: 0.002, d: dur * 0.5, s: 0.18, r: dur * 0.45 },
    });
  }
  reverb(b, { mix: 0.22, decay: 0.7 });
  return b;
}

/** The penalty row emptying: a soft dropped-stone thud. */
function penalty() {
  const b = buffer(0.55);
  tone(b, 0, 0.42, {
    freq: (x) => 260 * Math.pow(0.45, x),
    wave: sine,
    gain: 0.5,
    env: { a: 0.003, d: 0.12, s: 0.4, r: 0.25 },
  });
  noise(b, 0, 0.12, { gain: 0.16, lp: 0.2, env: { a: 0.002, d: 0.05, s: 0.2, r: 0.06 } });
  reverb(b, { mix: 0.15, decay: 0.6 });
  return b;
}

/** An end-of-game bonus line: a rising sparkle. */
function bonus() {
  const b = buffer(1.3);
  const scale = [72, 76, 79, 83, 84, 88, 91]; // C major over three octaves
  scale.forEach((m, i) => {
    tone(b, i * 0.055, 0.5, {
      freq: note(m),
      wave: sine,
      gain: 0.16,
      pan: -0.4 + (0.8 * i) / (scale.length - 1),
      env: { a: 0.002, d: 0.2, s: 0.15, r: 0.28 },
    });
    tone(b, i * 0.055, 0.35, {
      freq: note(m) * 2,
      gain: 0.05,
      env: { a: 0.002, d: 0.15, s: 0.1, r: 0.18 },
    });
  });
  reverb(b, { mix: 0.3, decay: 0.75 });
  return b;
}

/** The round settling: two soft chimes, a breath apart. */
function round() {
  const b = buffer(1.6);
  [
    [0, 69],
    [0.16, 76],
  ].forEach(([t, m]) => {
    for (const [ratio, gain] of [
      [1, 0.24],
      [2, 0.1],
      [3.01, 0.05],
    ]) {
      tone(b, t, 1.1, {
        freq: note(m) * ratio,
        gain,
        env: { a: 0.004, d: 0.5, s: 0.2, r: 0.55 },
      });
    }
  });
  reverb(b, { mix: 0.32, decay: 0.8 });
  return b;
}

/** Winning: a short major fanfare, warm rather than brassy. */
function win() {
  const b = buffer(2.6);
  const melody = [
    [0.0, 72, 0.22],
    [0.18, 76, 0.22],
    [0.36, 79, 0.22],
    [0.54, 84, 1.2],
  ];
  for (const [t, m, d] of melody) {
    tone(b, t, d, {
      freq: note(m),
      wave: (p) => sine(p) * 0.7 + tri(p) * 0.3,
      gain: 0.28,
      detune: 6,
      env: { a: 0.006, d: 0.12, s: 0.6, r: d * 0.6 },
    });
    tone(b, t, d, { freq: note(m + 12), gain: 0.07, env: { a: 0.006, d: 0.1, s: 0.4, r: d * 0.5 } });
  }
  for (const m of [48, 55, 60, 64]) {
    tone(b, 0.54, 1.6, { freq: note(m), wave: sine, gain: 0.13, detune: 5, env: { a: 0.02, d: 0.4, s: 0.5, r: 0.9 } });
  }
  reverb(b, { mix: 0.28, decay: 0.78 });
  return b;
}

/** Losing: the same shape, falling, and without the sting. */
function lose() {
  const b = buffer(2.4);
  const melody = [
    [0.0, 72, 0.26],
    [0.22, 69, 0.26],
    [0.44, 65, 0.26],
    [0.66, 60, 1.2],
  ];
  for (const [t, m, d] of melody) {
    tone(b, t, d, {
      freq: note(m),
      wave: (p) => sine(p) * 0.8 + tri(p) * 0.2,
      gain: 0.22,
      detune: 7,
      env: { a: 0.01, d: 0.15, s: 0.5, r: d * 0.7 },
    });
  }
  for (const m of [48, 55, 63]) {
    tone(b, 0.66, 1.5, { freq: note(m), gain: 0.1, detune: 5, env: { a: 0.04, d: 0.4, s: 0.45, r: 0.9 } });
  }
  reverb(b, { mix: 0.3, decay: 0.75 });
  return b;
}

/** Buttons, menus, toggles. Quieter and drier than a board move. */
function ui() {
  const b = buffer(0.12);
  tone(b, 0, 0.08, {
    freq: (x) => 1400 - 300 * x,
    wave: sine,
    gain: 0.22,
    env: { a: 0.001, d: 0.02, s: 0.2, r: 0.05 },
  });
  noise(b, 0, 0.03, { gain: 0.12, lp: 0.7, env: { a: 0.001, d: 0.012, s: 0.1, r: 0.015 } });
  return b;
}

// ---- music -----------------------------------------------------------

/**
 * One looping bed. Both tracks are the same machine with different settings:
 * a slow chord progression on a detuned pad, a sub bass on the root, and a
 * sparse bell figure picked deterministically from the chord.
 */
function bed({ bpm, chords, bars, bellEvery, bellGain, padGain, brightness, seedNotes }) {
  const beat = 60 / bpm;
  const bar = beat * 4;
  const tail = 6; // rendered past the loop point, then folded back in
  const b = buffer(bars * bar + tail);

  let rng = 1337;
  const rand = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  for (let i = 0; i < bars + 4; i += 1) {
    const chord = chords[i % chords.length];
    const t = i * bar;
    // Pad: three voices, softly detuned, breathing in over the bar.
    chord.forEach((m, v) => {
      tone(b, t, bar * 1.15, {
        freq: note(m),
        wave: (p) => sine(p) * 0.75 + tri(p) * 0.25,
        gain: padGain * (v === 0 ? 1 : 0.75),
        pan: v === 0 ? 0 : v === 1 ? -0.35 : 0.35,
        detune: 8 + v * 3,
        env: { a: bar * 0.35, d: bar * 0.2, s: 0.75, r: bar * 0.5 },
      });
    });
    // Sub bass on the root, one octave and a half below.
    tone(b, t, bar * 0.9, {
      freq: note(chord[0] - 24),
      wave: sine,
      gain: padGain * 1.5,
      env: { a: 0.08, d: bar * 0.3, s: 0.55, r: bar * 0.4 },
    });
    // Bells: one figure every `bellEvery` bars, drawn from the chord.
    if (i % bellEvery === 0) {
      const count = 2 + Math.floor(rand() * 3);
      for (let k = 0; k < count; k += 1) {
        const m = seedNotes[Math.floor(rand() * seedNotes.length)];
        const at = t + beat * (k * 1.5 + rand() * 0.4);
        for (const [ratio, g] of [
          [1, 1],
          [2.01, 0.35],
          [3.02, 0.12],
        ]) {
          tone(b, at, 1.4, {
            freq: note(m) * ratio,
            gain: bellGain * g,
            pan: rand() * 1.2 - 0.6,
            env: { a: 0.004, d: 0.6, s: 0.15, r: 0.7 },
          });
        }
      }
    }
  }

  lowpass(b, brightness);
  reverb(b, { mix: 0.42, decay: 0.84 });
  const looped = crossfadeLoop(b, tail);
  normalize(looped, 0.62);
  return looped;
}

/** Home, tutorial, leaderboards: slow, open, unhurried. */
function menuMusic() {
  return bed({
    bpm: 62,
    bars: 16,
    // Am - Fmaj7 - Cmaj7 - Gsus
    chords: [
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 64],
      [55, 62, 67],
    ],
    bellEvery: 2,
    bellGain: 0.075,
    padGain: 0.1,
    brightness: 2600,
    seedNotes: [76, 79, 81, 84, 88],
  });
}

/** In game: darker, sparser, and content to be ignored for twenty minutes. */
function gameMusic() {
  return bed({
    bpm: 54,
    bars: 20,
    // Dm9 - Bbmaj7 - Fmaj7 - Am7, all rootless and low
    chords: [
      [50, 57, 62],
      [46, 53, 60],
      [48, 52, 60],
      [45, 52, 59],
    ],
    bellEvery: 4,
    bellGain: 0.05,
    padGain: 0.085,
    brightness: 1700,
    seedNotes: [72, 74, 77, 81, 84],
  });
}

// ---- driver ----------------------------------------------------------

const SFX = { select, place, invalid, score, penalty, bonus, round, win, lose, ui };
const MUSIC = { menu: menuMusic, game: gameMusic };

function encode(buf, dest, bitrate) {
  mkdirSync(tmpDir, { recursive: true });
  const wav = join(tmpDir, 'render.wav');
  writeFileSync(wav, toWav(buf));
  mkdirSync(dirname(dest), { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', bitrate, dest]);
  rmSync(wav, { force: true });
}

for (const [name, make] of Object.entries(SFX)) {
  const b = make();
  normalize(b, 0.85);
  fadeEdges(b, 4);
  const dest = join(outDir, 'sfx', `${name}.mp3`);
  encode(b, dest, '96k');
  console.log(`sfx/${name}.mp3  ${(b.n / SR).toFixed(2)}s`);
}

for (const [name, make] of Object.entries(MUSIC)) {
  const b = make();
  const dest = join(outDir, 'music', `${name}.mp3`);
  encode(b, dest, '80k');
  console.log(`music/${name}.mp3  ${(b.n / SR).toFixed(1)}s`);
}
