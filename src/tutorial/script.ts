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
}

export type Step = TalkStep | MoveStep;

export const STEPS: Step[] = [
  {
    kind: 'talk',
    title: 'See the board',
    body: [
      'Pick tokens from the five attention nodes or the buffer. Place them into the context lines on your board.',
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
      'Take all three red tokens from Attention 2.',
    ],
    place: [
      'Place them in context line 3. They fit exactly.',
    ],
    after: [
      'Context line 3 is full. The tokens you left moved to the buffer.',
    ],
  },
  {
    kind: 'move',
    title: 'Use the buffer',
    source: CENTER,
    color: YELLOW,
    dest: 1,
    pick: [
      'Take the yellow token from the buffer.',
    ],
    place: [
      'Place it in context line 2.',
    ],
    after: [
      'The first player to draw from the buffer takes the initiative (“1”) marker: −1 point on your hallucination line, but you lead next round.',
    ],
  },
  {
    kind: 'move',
    title: 'Mind the overflow',
    source: 4,
    color: YELLOW,
    dest: 1,
    pick: [
      'Take both yellow tokens from Attention 5.',
    ],
    place: [
      'Place them in context line 2. Only one fits.',
    ],
    after: [
      'The extra token spills into your hallucination line. Avoid overflow when you can.',
    ],
  },
  {
    kind: 'move',
    title: 'Context lines can wait',
    source: CENTER,
    color: WHITE,
    dest: 4,
    pick: ['Take both white tokens from the buffer.'],
    place: [
      'Place them in context line 5. It does not need to fill this round.',
    ],
    after: [
      'Unfinished context lines stay for the next round. From now on, this line only takes white.',
    ],
  },
  {
    kind: 'move',
    title: 'Watch what you leave',
    source: 2,
    color: GREEN,
    dest: 3,
    pick: ['Take the green token from Attention 3.'],
    place: ['Start context line 4 with it.'],
    after: [
      'The three tokens you left moved to the buffer, where your rival could take them.',
    ],
  },
  {
    kind: 'move',
    title: 'Finish the round',
    source: CENTER,
    color: YELLOW,
    dest: 0,
    pick: [
      'Take the last yellow token from the buffer.',
    ],
    place: ['Place it in context line 1 to fill the line.'],
    after: [
      'The round ends. Full context lines crystallize one token onto your memory grid; the hallucination line costs you points.',
    ],
  },
  {
    kind: 'talk',
    title: 'Score memory clusters',
    spotlight: { kind: 'wall' },
    body: [
      'A token scores 1 alone, or the length of the row and column it joins in your memory grid. Build connected clusters.',
    ],
  },
  {
    kind: 'talk',
    title: 'Convergence',
    body: [
      'The game ends when anyone fills a row on their memory grid. Bonuses: +2 per row, +7 per column, +10 per complete color.',
    ],
  },
  {
    kind: 'talk',
    title: 'You’re ready',
    body: [
      'Pick one color frequency. Fill context lines. Build memory clusters. Keep tokens off your hallucination line.',
    ],
  },
];

/** Every move the learner makes, in order. Used by the script test. */
export const MOVE_STEPS = STEPS.filter((s): s is MoveStep => s.kind === 'move');
