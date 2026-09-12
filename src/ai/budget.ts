/**
 * What the AI is allowed to spend on a move.
 *
 * The levels used to be defined by a wall-clock budget: search until 450ms are
 * up, then answer with whatever you have. That makes the opponent's strength a
 * property of the player's hardware — the same Daily is a harder game on a
 * desktop than on a three-year-old phone, and a slow device quietly gets a
 * weaker opponent instead of a slower one.
 *
 * So strength is defined in units of work instead: a search depth for the
 * alpha-beta levels, a simulation count for `extreme`. Every device plays the
 * same opponent; a slow one only waits longer. The clock survives as
 * `AI_SAFETY_CAP_MS`, the stop-loss that keeps a search from becoming a hang —
 * which `extreme` in a late round does reach on ordinary hardware, so the
 * device-independence above holds for every level except that one.
 */

/**
 * Hard ceiling on a single search in the worker, in milliseconds.
 *
 * Most levels finish their work well inside this: the worst single move
 * measured for `master` is a ~2s outlier, with the other levels under 800ms.
 * `extreme` in a late round is the exception and does trip it — see
 * `EXTREME_STEPS_BY_ROUND` below. A search that trips the cap returns its best
 * answer so far and sets `cappedOut`: degraded, but never a hung tab.
 *
 * Thirty seconds is only tolerable because the search is on a worker, where the
 * cost of overrunning is a background thread and a player waiting. See
 * `AI_MAIN_THREAD_CAP_MS` for what happens when it is not.
 */
export const AI_SAFETY_CAP_MS = 30000;

/**
 * The same ceiling for a search that has fallen back to the UI thread.
 *
 * `AiClient` searches on the main thread when the worker cannot be created or
 * has died (AC-037). There the cost of a long search is not a busy background
 * thread, it is a frozen page: no input, no animation, no way to leave the
 * game. Thirty seconds of that is indistinguishable from a crash, so the
 * fallback trades strength for a page that stays alive. It is a rare path, and
 * a visibly weaker opponent on it is the better failure.
 */
export const AI_MAIN_THREAD_CAP_MS = 5000;

/**
 * The work `extreme` may spend on a move, in engine operations.
 *
 * Counting simulations is the obvious knob and the wrong one. A simulation
 * plays out to the end of the game, so what one costs depends entirely on where
 * the position sits: at the start of a round, with full displays and the whole
 * game still ahead, one costs ~18 engine operations, against ~8 in the endgame.
 * A fixed count therefore makes the time per move swing by more than a factor
 * of two, and a count affordable at a round boundary starves the endgame — the
 * phase this level exists to win.
 *
 * Budgeting the *work* instead — one unit per action applied or round settled
 * inside the search — normalizes that automatically. Expensive positions get
 * fewer, cheaper simulations get more, and the level costs about the same
 * everywhere. It also lands the simulations where they are worth most: the
 * endgame, where playouts are short and the search actually converges, is
 * exactly where the same work buys thousands of them instead of dozens. That is
 * the squeeze the level exists to apply.
 *
 * The schedule climbs by round on top of that, deliberately spending more real
 * time as the game closes, where a precise read decides it.
 *
 * These are not the final numbers. `MctsAgent` multiplies them by 2.5 once the
 * position is near the endgame (`isNearEndgame`), so the real ceiling in round
 * 5 is 1,075,000 steps rather than the 430,000 below. That is more than a
 * 30-second safety cap buys: measured on an idle M-series Mac, a round-5
 * near-endgame move reached 380k-816k steps across three runs and tripped the
 * cap every time. Two consequences worth knowing before tuning these numbers:
 * `extreme` in a late round is running at a fraction of its nominal strength,
 * and — because the truncation point moves with the machine's load — the same
 * position does not always get the same move, which is the one property the
 * work budget exists to guarantee.
 *
 * Calibrated from manual games played with the proven 450ms agent on 2026-09-02.
 * That agent actually spent 82k-109k operations in round 1, 96k-118k in round
 * 2, 100k-129k in round 3, 104k-153k in round 4, and 144k-429k in round 5.
 * The earlier 4.5k-18k schedule therefore removed roughly 88-96% of its search
 * and was not strength-equivalent. These conservative per-round ceilings retain
 * at least the measured work of the strong version while making it independent
 * of processor speed.
 */
export const EXTREME_STEPS_BY_ROUND = [110000, 120000, 130000, 155000, 430000] as const;

/** The schedule's last entry stands for every round beyond it. */
export function extremeSteps(round: number): number {
  const table = EXTREME_STEPS_BY_ROUND;
  const index = Math.min(Math.max(round, 1), table.length) - 1;
  return table[index];
}
