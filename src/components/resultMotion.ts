/**
 * Timing helpers for the result screen's staged reveal.
 *
 * The screen is a small show: the verdict lands, the score counts up, the stats
 * drop in, then the call to action lights up. Keeping the clock here means the
 * card itself only asks "which stage are we in" and renders that, and the whole
 * show can be skipped in one place when the player has asked for less motion.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

/** True when the player (or the OS) has asked for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    [],
  );
}

/**
 * Walk a list of millisecond marks, returning how many have passed.
 *
 * `skip` jumps straight to the end, so a reduced-motion player sees the final
 * frame on the first paint rather than a faster version of the animation.
 */
export function useTimeline(marks: readonly number[], skip: boolean): number {
  const [stage, setStage] = useState(() => (skip ? marks.length : 0));

  useEffect(() => {
    if (skip) {
      setStage(marks.length);
      return;
    }
    const timers = marks.map((at, i) => window.setTimeout(() => setStage(i + 1), at));
    return () => timers.forEach(window.clearTimeout);
    // The marks are a literal in the caller; length is the identity that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, marks.length]);

  return stage;
}

/**
 * Count from 0 to `target` once `active` turns true.
 *
 * `onTick` fires a bounded number of times (not once per frame) so the caller
 * can hang a sound on it without machine-gunning the mixer.
 */
export function useCountUp(
  target: number,
  active: boolean,
  durationMs: number,
  onTick?: (value: number, progress: number) => void,
): number {
  const [value, setValue] = useState(active ? target : 0);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    if (!active) return;
    if (durationMs <= 0 || target <= 0) {
      setValue(target);
      return;
    }
    let raf = 0;
    let ticks = 0;
    const maxTicks = 8;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      // Ease out: the number sprints, then settles on the final figure.
      const eased = 1 - Math.pow(1 - p, 3);
      const next = Math.round(target * eased);
      setValue(next);
      if (p >= ticks / maxTicks && ticks < maxTicks) {
        ticks += 1;
        tickRef.current?.(next, p);
      }
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, durationMs]);

  return value;
}
