/**
 * Building and reading shareable replay links.
 *
 * The code rides in the *path* (`/r/<code>`), not a fragment. A fragment never
 * reaches the server, which kept replay codes out of access logs but also kept
 * them away from the one thing that needs them: the link preview. Every
 * shared game looked identical in Slack, on X and in a chat app, because the
 * only thing the crawler could see was the generic site card.
 *
 * The privacy that buys is small — a replay code is a seed plus one byte per
 * move, no account, no name, and for a Daily game the same code is already
 * stored server-side to verify the score (`worker/replay.ts`). `worker/share.ts`
 * decodes the path and answers with this game's own card.
 */

import type { QuadroGame } from '../engine';
import { type Replay, type ReplayAiLevel, encodeReplay } from './codec';
import { ENGINE_VERSION } from './version';
import { SITE_NAME } from '../site';

export const REPLAY_PATH = '/r';

/** Snapshot a finished (or in-progress) game as a shareable replay. */
export function replayOf(
  game: QuadroGame,
  options: { aiLevel: ReplayAiLevel; humanSeat: number; puzzleId: string | null },
): Replay {
  const scores = game.state.players.map((p) => p.score);
  return {
    engineVersion: ENGINE_VERSION,
    seed: game.seed,
    firstPlayer: game.firstPlayer,
    humanSeat: options.humanSeat,
    aiLevel: options.aiLevel,
    scores: [scores[0], scores[1]],
    puzzleId: options.puzzleId,
    actions: game.history.map((a) => a.actionId),
  };
}

/**
 * The in-app href for an already-encoded replay code.
 *
 * Every link to a replay goes through here — the leaderboard, the history
 * page and `replayUrl` below — so the shape of a replay link is decided in
 * one place.
 */
export function replayHref(code: string): string {
  return `${REPLAY_PATH}/${code}`;
}

export function replayUrl(replay: Replay, origin = window.location.origin): string {
  return `${origin}${replayHref(encodeReplay(replay))}`;
}

/**
 * The text recap that gets pasted next to the link.
 *
 * Deliberately spoiler-free about *how* the game was won: it reports the
 * result, not the moves, so posting it does not give away the day's deal.
 */
export function recapText(
  replay: Replay,
  options: { levelLabel: string; elapsedMs?: number; rank?: number | null; totalEntries?: number | null },
): string {
  const mine = replay.scores[replay.humanSeat];
  const theirs = replay.scores[1 - replay.humanSeat];
  const margin = mine - theirs;
  const lines = [
    `${SITE_NAME} ${replay.puzzleId ?? 'Practice'} · ${options.levelLabel}`,
    `${mine}–${theirs} (${margin >= 0 ? '+' : ''}${margin})${
      options.elapsedMs === undefined ? '' : ` · ${formatDuration(options.elapsedMs)}`
    }${
      options.rank == null
        ? ''
        : ` · #${options.rank}${options.totalEntries ? ` / ${options.totalEntries}` : ''}`
    }`,
  ];
  return lines.join('\n');
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * The whole share payload for a finished game: the link that replays it and
 * the recap line that goes beside the link.
 *
 * One helper rather than two call sites doing `replayOf` → `replayUrl` and
 * `recapText` separately, because the two must describe the same game — the
 * bug this replaced shared a recap of *your* game next to a link to the
 * *daily page*. Returns null for a game that cannot be encoded (absurdly
 * long); callers hide the share control rather than offer a broken link.
 */
export function shareFor(
  game: QuadroGame,
  options: { aiLevel: ReplayAiLevel; humanSeat: number; puzzleId: string | null },
  recap: {
    levelLabel: string;
    elapsedMs?: number;
    rank?: number | null;
    totalEntries?: number | null;
  },
): { url: string; text: string } | null {
  try {
    const replay = replayOf(game, options);
    return { url: replayUrl(replay), text: recapText(replay, recap) };
  } catch {
    return null;
  }
}
