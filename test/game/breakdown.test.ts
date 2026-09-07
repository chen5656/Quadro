/** The result screen's match summary, diffed out of the event stream. */

import { describe, expect, it } from 'vitest';

import type { GameEvent } from '../../src/engine/events';
import { bestRound, matchBreakdown, roundsWon } from '../../src/game/breakdown';

const roundEnd = (round_num: number, scores: number[]): GameEvent => ({
  kind: 'round_end',
  round_num,
  scores,
});

const EVENTS: GameEvent[] = [
  { kind: 'round_start', round_num: 1, first_player: 0, bag_refilled: false, short_displays: 0 },
  roundEnd(1, [12, 9]),
  roundEnd(2, [20, 18]),
  roundEnd(3, [34, 26]),
  { kind: 'bonus', player: 0, rows: 1, columns: 1, colors: 0, points: 9 },
  { kind: 'bonus', player: 1, rows: 2, columns: 0, colors: 1, points: 14 },
  { kind: 'game_end', scores: [43, 40], winner: 0, draw: false },
];

describe('matchBreakdown', () => {
  it('turns running totals into per-round swings', () => {
    expect(matchBreakdown(EVENTS, 0).rounds).toEqual([
      { round: 1, you: 12, opponent: 9, delta: 3 },
      { round: 2, you: 8, opponent: 9, delta: -1 },
      { round: 3, you: 14, opponent: 8, delta: 6 },
    ]);
  });

  it('carries the end-game bonuses, which land after the last round', () => {
    expect(matchBreakdown(EVENTS, 0).bonus).toEqual({
      you: { rows: 1, columns: 1, colors: 0, points: 9 },
      opponent: { rows: 2, columns: 0, colors: 1, points: 14 },
      delta: -5,
    });
  });

  it('adds up to the final score', () => {
    const { rounds, bonus } = matchBreakdown(EVENTS, 0);
    const you = rounds.reduce((n, r) => n + r.you, 0) + (bonus?.you.points ?? 0);
    const opponent = rounds.reduce((n, r) => n + r.opponent, 0) + (bonus?.opponent.points ?? 0);
    expect([you, opponent]).toEqual([43, 40]);
  });

  it('reads the other seat when the human is player 1', () => {
    const { rounds, bonus } = matchBreakdown(EVENTS, 1);
    expect(rounds.map((r) => r.delta)).toEqual([-3, 1, -6]);
    expect(bonus?.delta).toBe(5);
  });

  it('has nothing to show for a game that never closed a round', () => {
    const { rounds, bonus } = matchBreakdown([EVENTS[0]], 0);
    expect(rounds).toEqual([]);
    expect(bonus).toBeNull();
    expect(bestRound([])).toBeNull();
    expect(roundsWon([])).toBe(0);
  });

  it('counts won rounds and finds the best swing', () => {
    const { rounds } = matchBreakdown(EVENTS, 0);
    expect(roundsWon(rounds)).toBe(2);
    expect(bestRound(rounds)?.round).toBe(3);
  });
});
