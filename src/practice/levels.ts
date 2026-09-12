/**
 * Which opponent Practice faces and how a choice is written to the URL.
 *
 * Mirrors `src/daily/levels.ts`: the level lives in `?ai=`, not in component
 * state, so anything that can navigate — the setup grid or the header's ⚙ menu
 * — can change it.
 */

import { LEVELS, type AgentLevel } from '../ai/base';
import { storage } from '../storage';

/** Strongest first, matching the Daily's picker order. */
export const PRACTICE_LEVELS: readonly AgentLevel[] = [
  'extreme',
  'master',
  'expert',
  'hard',
  'medium',
  'easy',
] as const;

const isLevel = (value: string | null): value is AgentLevel =>
  value !== null && (LEVELS as readonly string[]).includes(value);

/**
 * Which opponent a Practice URL means. The URL wins; failing that, the one this
 * device last played; failing that, Easy for a first-time player.
 */
export function resolvePracticeLevel(search: string): AgentLevel {
  const params = new URLSearchParams(search);
  const level = params.get('level') ?? params.get('ai');
  if (isLevel(level)) return level;
  const remembered = storage.practiceLevel();
  return isLevel(remembered) ? remembered : 'easy';
}

export function practiceHrefFor(level: AgentLevel, search = window.location.search): string {
  const params = new URLSearchParams(search);
  params.delete('ai');
  params.set('level', level);
  return `/practice?${params.toString()}`;
}
