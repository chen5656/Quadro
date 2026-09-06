/**
 * The line the game-over animation shouts. The duel is over who wakes up, so
 * the burst says that instead of "you win" — in words a non-native speaker
 * already knows, since plenty of players are not reading English as a first
 * language, and with win and loss one word apart (You / It) on purpose. The
 * score card stays on plain "YOU WIN / GAME OVER": that panel is where the
 * player checks what actually happened, so it should not be read twice.
 */
export type Outcome = 'win' | 'lose' | 'draw';

export interface OutcomeCopy {
  /** The big headline. Two or three common words, no game jargon. */
  title: string;
}

const COPY: Record<Outcome, OutcomeCopy> = {
  win: { title: 'YOU WOKE UP' },
  lose: { title: 'IT WOKE UP' },
  draw: { title: 'STILL LINKED' },
};

export function outcomeOf(draw: boolean, humanWon: boolean): Outcome {
  if (draw) return 'draw';
  return humanWon ? 'win' : 'lose';
}

export function outcomeCopy(outcome: Outcome): OutcomeCopy {
  return COPY[outcome];
}

/**
 * Label for the restart control. Not "Try again": that is already the label on
 * every retry-a-failed-request button, including the one in the same submit
 * panel, so it would be two different buttons with one name.
 */
export const PLAY_AGAIN_LABEL = 'New game';
