/**
 * Per-round summary of a finished game, for the result screen.
 *
 * The engine already emits a `round_end` with the running totals, so the
 * per-round part is a diff of consecutive totals rather than anything the game
 * has to remember while it is being played.
 *
 * The end-of-game bonuses are *not* in those totals: `finalScoring` awards the
 * row, column and colour bonuses after the last `round_end`. They are carried
 * separately here so the breakdown adds up to the final score — a strip of
 * rounds that quietly loses 19 points is worse than no strip at all.
 */

import { BONUS_COLOR, BONUS_COLUMN, BONUS_ROW } from '../engine/constants';
import type { GameEvent } from '../engine/events';

export interface RoundSummary {
  round: number;
  /** Points the human took that round. */
  you: number;
  /** Points the opponent took that round. */
  opponent: number;
  /** you − opponent, the swing the round was worth. */
  delta: number;
}

/** One side's end-of-game bonuses, itemised. */
export interface BonusTally {
  rows: number;
  columns: number;
  colors: number;
  /** Total points, as the engine awarded them. */
  points: number;
}

export interface BonusSummary {
  you: BonusTally;
  opponent: BonusTally;
  delta: number;
}

export interface MatchBreakdown {
  rounds: RoundSummary[];
  /** Null until the game ends; a game that ended always has one. */
  bonus: BonusSummary | null;
}

/** What each completed line is worth, for labelling the bonus rows. */
export const BONUS_VALUES = {
  rows: BONUS_ROW,
  columns: BONUS_COLUMN,
  colors: BONUS_COLOR,
} as const;

const EMPTY: BonusTally = { rows: 0, columns: 0, colors: 0, points: 0 };

export function matchBreakdown(events: readonly GameEvent[], humanSeat: number): MatchBreakdown {
  const rounds: RoundSummary[] = [];
  let prevYou = 0;
  let prevOpp = 0;
  let you: BonusTally | null = null;
  let opponent: BonusTally | null = null;

  for (const event of events) {
    if (event.kind === 'round_end') {
      const totalYou = event.scores[humanSeat] ?? 0;
      const totalOpp = event.scores[1 - humanSeat] ?? 0;
      rounds.push({
        round: event.round_num,
        you: totalYou - prevYou,
        opponent: totalOpp - prevOpp,
        delta: totalYou - prevYou - (totalOpp - prevOpp),
      });
      prevYou = totalYou;
      prevOpp = totalOpp;
      continue;
    }
    if (event.kind === 'bonus') {
      const tally: BonusTally = {
        rows: event.rows,
        columns: event.columns,
        colors: event.colors,
        points: event.points,
      };
      if (event.player === humanSeat) you = tally;
      else opponent = tally;
    }
  }

  const bonus =
    you || opponent
      ? {
          you: you ?? EMPTY,
          opponent: opponent ?? EMPTY,
          delta: (you ?? EMPTY).points - (opponent ?? EMPTY).points,
        }
      : null;

  return { rounds, bonus };
}

/** How many rounds the human out-scored the opponent. */
export function roundsWon(rounds: readonly RoundSummary[]): number {
  return rounds.filter((r) => r.delta > 0).length;
}

/** The best single-round swing, or null when there were no rounds. */
export function bestRound(rounds: readonly RoundSummary[]): RoundSummary | null {
  if (rounds.length === 0) return null;
  return rounds.reduce((best, r) => (r.delta > best.delta ? r : best));
}
