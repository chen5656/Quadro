/**
 * The scripted lesson: one full round of NODRA, move by move.
 *
 * The whole lesson is deterministic. Seed 7 deals the opening below, the
 * opponent is the greedy agent (synchronous, seeded, <5ms), and the learner's
 * six moves are fixed — so every line of coaching text can name concrete tokens
 * and concrete numbers and still be true. `test/ui/tutorial-script.test.ts`
 * replays the whole script against the engine to keep it that way.
 *
 * Round 1 of seed 7:
 *   A1: BB K W   A2: Y RRR   A3: B Y R K   A4: B Y R K   A5: YY R W
 */

import { CENTER, GREEN, RED, WHITE, YELLOW } from '../engine';

/** The deal the lesson is written against. Changing it invalidates every step. */
export const TUTORIAL_SEED = 7;
/** The human always leads, so step 1 is the very first move of the game. */
export const TUTORIAL_FIRST_PLAYER = 0;
export const TUTORIAL_HUMAN_SEAT = 0;
/**
 * The greedy opponent's seed. It only ever breaks ties between equally valued
 * replies, but those ties decide the exact line the lesson text describes, so
 * it is pinned here next to the deal rather than derived somewhere else — the
 * script test replays the whole round against it.
 */
export const TUTORIAL_OPPONENT_SEED = 4;
export const OPPONENT_LABEL = 'Coach';

/**
 * What to ring on the board while a step is open. `source` indexes an attention
 * node (0..4) or the buffer; `row` a context line; `floor` the hallucination row.
 */
export type Spotlight =
  | { kind: 'source'; index: number }
  | { kind: 'row'; index: number }
  | { kind: 'floor' }
  | { kind: 'wall' };

/** A step with nothing to click: read it, press Next. */
export interface TalkStep {
  kind: 'talk';
  title: string;
  body: string[];
  spotlight?: Spotlight;
}

/**
 * A step the learner plays. `source`/`color`/`dest` are the only move the board
 * will accept while the step is open, which is what makes the coaching exact.
 */
export interface MoveStep {
  kind: 'move';
  title: string;
  source: number;
  color: number;
  dest: number;
  /** Shown until the learner has picked the group. */
  pick: string[];
  /** Shown once the group is picked, until it is placed. */
  place: string[];
  /** Shown after the move has landed and the opponent has answered. */
  after: string[];
  /** Spotlight target during the 'after' review phase, if different from the placed row. */
  afterSpotlight?: Spotlight;
}

export type Step = TalkStep | MoveStep;

export const STEPS: Step[] = [
  {
    kind: 'talk',
    title: 'See the board',
    body: [
      'Take turns picking tokens from nodes or the buffer.',
      'A round ends and refills only after all tokens are drafted.',
    ],
    spotlight: { kind: 'source', index: 1 },
  },
  {
    kind: 'move',
    title: 'Take one color',
    source: 1,
    color: RED,
    dest: 2,
    pick: [
      'Take 3 red tokens from Attention 2.',
    ],
    place: [
      'Place them in context line 3 (exact fit).',
    ],
    after: [
      'Context line 3 is full.',
      'Leftover tokens move to the buffer.',
    ],
    afterSpotlight: { kind: 'source', index: CENTER },
  },
  {
    kind: 'move',
    title: 'Use the buffer',
    source: CENTER,
    color: YELLOW,
    dest: 1,
    pick: [
      'Take yellow from the buffer.',
    ],
    place: [
      'Place it in context line 2.',
    ],
    after: [
      'First to draw buffer takes the “1” marker.',
      '−1 pt penalty, but you lead next round.',
    ],
    afterSpotlight: { kind: 'floor' },
  },
  {
    kind: 'move',
    title: 'Mind the overflow',
    source: 4,
    color: YELLOW,
    dest: 1,
    pick: [
      'Take 2 yellow tokens from Attention 5.',
    ],
    place: [
      'Place in context line 2 (only 1 fits).',
    ],
    after: [
      'Extra token spills into hallucination line.',
      'Avoid overflow to save points.',
    ],
    afterSpotlight: { kind: 'floor' },
  },
  {
    kind: 'move',
    title: 'Context lines can wait',
    source: CENTER,
    color: WHITE,
    dest: 4,
    pick: ['Take 2 white tokens from buffer.'],
    place: [
      'Place in line 5 (no need to fill now).',
    ],
    after: [
      'Unfinished lines carry over to next round.',
      'Locked to white until completed.',
    ],
    afterSpotlight: { kind: 'row', index: 4 },
  },
  {
    kind: 'move',
    title: 'Watch what you leave',
    source: 2,
    color: GREEN,
    dest: 3,
    pick: ['Take 1 green token from Attention 3.'],
    place: ['Start context line 4 with it.'],
    after: [
      '3 leftover tokens moved to the buffer.',
      'Rival can now take them.',
    ],
    afterSpotlight: { kind: 'source', index: CENTER },
  },
  {
    kind: 'move',
    title: 'Finish the round',
    source: CENTER,
    color: YELLOW,
    dest: 0,
    pick: [
      'Take last yellow from the buffer.',
    ],
    place: ['Place in line 1 to fill it.'],
    after: [
      'All tokens on the table are drafted — round ends!',
      'Full lines crystallize onto memory grid, excess deducts pts.',
      'A new round will refill 4 tokens on each attention node.',
    ],
    afterSpotlight: { kind: 'wall' },
  },
  {
    kind: 'talk',
    title: 'Score memory clusters',
    spotlight: { kind: 'wall' },
    body: [
      '1 pt alone, or length of connected row/col.',
      'Build connected clusters for high scores.',
    ],
  },
  {
    kind: 'talk',
    title: 'Convergence',
    body: [
      'Game ends when any row is completed.',
      'Bonuses: +2/row, +7/col, +10/full color.',
    ],
  },
  {
    kind: 'talk',
    title: 'You’re ready',
    body: [
      'Pick one color group.',
      'Fill context lines.',
      'Build memory clusters.',
      'Avoid hallucination penalties.',
    ],
  },
];

/** Every move the learner makes, in order. Used by the script test. */
export const MOVE_STEPS = STEPS.filter((s): s is MoveStep => s.kind === 'move');
