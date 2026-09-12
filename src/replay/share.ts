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

import { GRID_COLOR, type QuadroGame } from '../engine';
import { type Replay, type ReplayAiLevel, encodeReplay } from './codec';
import { ENGINE_VERSION } from './version';
import { SITE_NAME } from '../site';
import { runReplay } from './rebuild';

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
 * Maps the 5 Quadro tile colors to high-contrast square emojis.
 * Blue: 🟦, Yellow: 🟨, Red: 🟥, Green: 🟩, White: ⬛
 */
const TILE_EMOJIS = ['🟦', '🟨', '🟥', '🟩', '⬛'] as const;
const EMPTY_TILE_EMOJI = '⬜';

/**
 * Formats a player's 5x5 wall into a Wordle-like emoji block.
 */
export function wallGridEmoji(grid: boolean[][]): string {
  return grid
    .map((row, r) =>
      row
        .map((filled, c) => (filled ? TILE_EMOJIS[GRID_COLOR[r][c]] : EMPTY_TILE_EMOJI))
        .join(''),
    )
    .join('\n');
}

/**
 * The text recap that gets pasted next to the link.
 *
 * Deliberately spoiler-free about *how* the game was won: it reports the
 * result, not the moves, so posting it does not give away the day's deal.
 */
export function recapText(
  replay: Replay,
  options: {
    levelLabel: string;
    elapsedMs?: number;
    rank?: number | null;
    totalEntries?: number | null;
    rounds?: number | null;
    wallGrid?: boolean[][] | null;
  },
): string {
  const mine = replay.scores[replay.humanSeat];
  const theirs = replay.scores[1 - replay.humanSeat];
  const margin = mine - theirs;

  const outcomeBadge =
    margin > 0
      ? `🏆 Victory vs ${options.levelLabel}`
      : margin < 0
        ? `🥈 Defeat vs ${options.levelLabel}`
        : `🤝 Tie vs ${options.levelLabel}`;

  const modeBadge = replay.puzzleId ? `Daily ${replay.puzzleId}` : 'Practice';

  const statsMeta: string[] = [];
  if (options.elapsedMs !== undefined) {
    statsMeta.push(`⏱️ ${formatDuration(options.elapsedMs)}`);
  }
  if (options.rounds != null && options.rounds > 0) {
    statsMeta.push(`${options.rounds} Rounds`);
  }
  if (options.rank != null) {
    statsMeta.push(`#${options.rank}${options.totalEntries ? `/${options.totalEntries}` : ''}`);
  }

  // If wallGrid is not passed directly, derive it by running the replay if actions exist.
  let wallEmoji = '';
  const grid =
    options.wallGrid ??
    (replay.actions.length > 0
      ? (() => {
          try {
            const finished = runReplay(replay);
            return finished.state.players[replay.humanSeat].grid;
          } catch {
            return null;
          }
        })()
      : null);

  if (grid) {
    wallEmoji = wallGridEmoji(grid);
  }

  const lines = [
    `${SITE_NAME} ${modeBadge}`,
    `${outcomeBadge} · ${mine}–${theirs} (${margin >= 0 ? '+' : ''}${margin})`,
    ...(statsMeta.length > 0 ? [statsMeta.join(' · ')] : []),
    ...(wallEmoji ? ['', wallEmoji] : []),
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
    const humanGrid = game.state.players[options.humanSeat].grid;
    const rounds = game.state.round_num;

    return {
      url: replayUrl(replay),
      text: recapText(replay, {
        ...recap,
        rounds,
        wallGrid: humanGrid,
      }),
    };
  } catch {
    return null;
  }
}

