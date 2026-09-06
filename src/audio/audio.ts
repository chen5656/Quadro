/**
 * The game's audio, as one module-level singleton.
 *
 * A singleton rather than a hook because most of what makes noise is not a
 * React component: the animator plays the scoring bells from inside an async
 * flight, and the session plays moves from a callback. Anything that can import
 * this can make a sound; the React side (`SoundProvider`) only owns the
 * settings UI and subscribes for re-renders.
 *
 * Two independent switches, both remembered (FR-032 keeps game state out of
 * localStorage; a preference is fine):
 *   - music: the looping background bed
 *   - sfx:   every one-shot
 * Turning both off is silence; turning off only sfx leaves the music playing.
 *
 * Nothing is fetched until sound is actually wanted, and nothing can start
 * before the first user gesture — browsers refuse autoplay, so the bed is armed
 * and started on the first pointer or key event.
 */

import { storage } from '../storage';

export type SfxId =
  | 'select'
  | 'place'
  | 'invalid'
  | 'score'
  | 'penalty'
  | 'bonus'
  | 'round'
  | 'win'
  | 'lose'
  | 'ui';

export type MusicId = 'menu' | 'game';

export interface SoundSettings {
  music: boolean;
  sfx: boolean;
}

const SFX_URL = (id: SfxId) => `/audio/sfx/${id}.mp3`;
const MUSIC_URL = (id: MusicId) => `/audio/music/${id}.mp3`;

/** Per-sound trim, so one design does not have to be re-rendered to sit right. */
const SFX_GAIN: Record<SfxId, number> = {
  select: 0.5,
  place: 0.6,
  invalid: 0.45,
  score: 0.55,
  penalty: 0.6,
  bonus: 0.6,
  round: 0.55,
  win: 0.7,
  lose: 0.6,
  ui: 0.35,
};

const MUSIC_GAIN = 0.34;
/** Two of the same one-shot inside this many ms is one sound, not two. */
const DEDUPE_MS = 35;

class Audio {
  private settings: SoundSettings = {
    music: storage.soundMusic() !== 'off',
    sfx: storage.soundSfx() !== 'off',
  };

  private listeners = new Set<() => void>();

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();

  private current: MusicId | null = null;
  private source: AudioBufferSourceNode | null = null;
  /**
   * The bed the app wants playing, which is not the same as the one that is
   * playing: it survives the music being switched off, the context being
   * suspended before the first gesture, and everything else that stops sound
   * without changing where the player is. Without it, switching music off and
   * on again left silence — the route had not changed, so nothing re-asked.
   */
  private requested: MusicId | null = null;
  private armed = false;
  private lastPlayed = new Map<SfxId, number>();
  private failed = false;

  // ---- settings ------------------------------------------------------

  get(): SoundSettings {
    return this.settings;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    this.settings = { ...this.settings };
    for (const fn of this.listeners) fn();
  }

  setMusic(on: boolean): void {
    this.settings.music = on;
    storage.setSoundMusic(on ? 'on' : 'off');
    if (on) {
      const want = this.requested;
      this.current = null;
      if (want) void this.playMusic(want);
    } else {
      this.stopMusic();
    }
    this.emit();
  }

  setSfx(on: boolean): void {
    this.settings.sfx = on;
    storage.setSoundSfx(on ? 'on' : 'off');
    this.emit();
  }

  /** Both off, for the "mute everything" affordance. */
  muteAll(): void {
    this.setMusic(false);
    this.setSfx(false);
  }

  // ---- plumbing ------------------------------------------------------

  /**
   * The one place an AudioContext is created. Returns null where Web Audio is
   * missing or blocked (older Safari in private mode, some embedded webviews);
   * every caller treats that as "this game is silent" and carries on.
   */
  private context(): AudioContext | null {
    if (this.failed) return null;
    if (this.ctx) return this.ctx;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        this.failed = true;
        return null;
      }
      // Without this, iOS silences Web Audio whenever the ringer switch is
      // off — the phone treats the page as ambient noise rather than something
      // the player asked to hear. Safari 17+; harmless everywhere else.
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';

      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
    } catch {
      this.failed = true;
      return null;
    }
    // A context is born suspended. Arm the first-gesture handler now rather
    // than waiting for something to fail, so the very first tap resumes it.
    this.arm();
    return this.ctx;
  }

  private async load(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) return cached;
    const inflight = this.loading.get(url);
    if (inflight) return inflight;

    const ctx = this.context();
    if (!ctx) return null;

    const task = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const bytes = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(bytes);
        this.buffers.set(url, decoded);
        return decoded;
      } catch {
        // A missing or undecodable file costs this one sound and nothing else.
        return null;
      } finally {
        this.loading.delete(url);
      }
    })();
    this.loading.set(url, task);
    return task;
  }

  /**
   * Resume the context, which starts life suspended until a gesture.
   *
   * Returns whether it is running, so callers can decide to wait rather than
   * fire a sound into a suspended context and lose it.
   */
  private async resume(): Promise<boolean> {
    const ctx = this.context();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        return false;
      }
    }
    return ctx.state === 'running';
  }

  /**
   * Listen once for the first real interaction, then start whatever music was
   * asked for before the browser would allow it.
   */
  private arm(): void {
    if (this.armed || typeof window === 'undefined') return;
    this.armed = true;
    const go = () => {
      void (async () => {
        if (!(await this.resume())) return;
        // The sounds a first-time player hits within a second of arriving.
        // Loaded now so the tap after this one is not the one that waits.
        for (const id of ['select', 'place', 'ui'] as SfxId[]) void this.load(SFX_URL(id));
        const want = this.requested;
        if (want && this.settings.music) {
          this.current = null;
          await this.playMusic(want);
        }
      })();
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
      window.removeEventListener('touchstart', go);
      this.armed = false;
    };
    window.addEventListener('pointerdown', go, { once: true });
    window.addEventListener('keydown', go, { once: true });
    window.addEventListener('touchstart', go, { once: true });
  }

  // ---- one-shots -----------------------------------------------------

  /**
   * Play a one-shot. Cheap to call from anywhere and safe to call often: it is
   * a no-op when sfx are off, and identical sounds inside `DEDUPE_MS` collapse
   * into one so a burst of simultaneous events cannot phase into a slap.
   */
  play(id: SfxId, { rate = 1, gain = 1 }: { rate?: number; gain?: number } = {}): void {
    if (!this.settings.sfx) return;
    const now = Date.now();
    const last = this.lastPlayed.get(id) ?? 0;
    if (now - last < DEDUPE_MS) return;
    this.lastPlayed.set(id, now);

    const ctx = this.context();
    if (!ctx || !this.master) return;
    // Kicked synchronously, before anything is awaited: iOS only honours a
    // resume that happens inside the gesture that triggered it, and awaiting
    // the fetch first would put this on the far side of that boundary.
    void this.resume();

    void (async () => {
      const buffer = await this.load(SFX_URL(id));
      if (!buffer || !this.settings.sfx || !this.master) return;
      if (ctx.state !== 'running' && !(await this.resume())) return;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      const g = ctx.createGain();
      g.gain.value = SFX_GAIN[id] * gain;
      src.connect(g).connect(this.master);
      src.start();
    })();
  }

  // ---- music ---------------------------------------------------------

  /**
   * Cross-fade to `id` and loop it. Calling with the track already playing does
   * nothing, so a component may call it on every render.
   */
  async playMusic(id: MusicId): Promise<void> {
    // Recorded first and unconditionally: this is the app saying where the
    // player is, which stays true whether or not it can be heard right now.
    this.requested = id;
    if (!this.settings.music) return;
    if (this.current === id && this.source) return;

    const ctx = this.context();
    if (!ctx || !this.musicGain) return;
    if (!(await this.resume())) {
      // Before the first gesture. `arm` will come back to this.
      this.arm();
      return;
    }

    const buffer = await this.load(MUSIC_URL(id));
    if (!buffer || !this.settings.music) return;
    if (this.current === id && this.source) return;

    this.stopMusic({ fade: 0.6 });

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.source = src;
    this.current = id;

    const now = ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.musicGain.gain.linearRampToValueAtTime(MUSIC_GAIN, now + 1.4);
  }

  /** Fade the bed out and release it. Safe to call when nothing is playing. */
  stopMusic({ fade = 0.5 }: { fade?: number } = {}): void {
    const ctx = this.ctx;
    const src = this.source;
    this.source = null;
    this.current = null;
    if (!ctx || !this.musicGain) return;
    const now = ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(Math.max(this.musicGain.gain.value, 0.0001), now);
    this.musicGain.gain.linearRampToValueAtTime(0.0001, now + fade);
    if (src) {
      try {
        src.stop(now + fade + 0.05);
      } catch {
        // Already stopped.
      }
    }
  }
}

export const audio = new Audio();

/** Shorthand for the many call sites that only ever fire one-shots. */
export const sfx = (id: SfxId, opts?: { rate?: number; gain?: number }) => audio.play(id, opts);
