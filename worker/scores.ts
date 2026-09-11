/**
 * `POST /api/scores` — the only write path (BR-010).
 *
 * The Worker authenticates, applies the two sanity rules (BR-011, BR-012),
 * rate-limits (BR-013), and stores.
 *
 * D-015's "trust the client" posture holds only for submissions with no
 * replay attached. When one is attached the Worker *does* re-simulate: it
 * re-runs the recorded moves through the engine and refuses the submission
 * unless they produce the posted score. See `worker/replay.ts`.
 */

import type { Session } from './auth';
import { currentPuzzleId, isPuzzleId, seedForPuzzle } from './daily';
import { HttpError, json } from './http';
import { DEFAULT_AI_LEVEL, type AiLevel, isAiLevel, isRankedAiLevel, rankOf } from './leaderboard';
import { MAX_REPLAY_CHARS, checkReplay } from './replay';

/** BR-011: a five-round game against a 450ms agent cannot be won in 20 seconds. */
export const MIN_ELAPSED_MS = 20_000;
export const MAX_ELAPSED_MS = 7_200_000;

/** BR-013: per-user submissions allowed in a rolling hour. */
export const RATE_LIMIT_PER_HOUR = 60;

export interface SubmissionPayload {
  puzzle_id: string;
  elapsed_ms: number;
  final_score: number;
  opponent_score: number;
  rounds: number;
  ai_level: AiLevel;
  client_version: string;
  attempts?: number;
  /**
   * The base64url replay code (`src/replay/codec.ts`). Optional: clients from
   * before replays existed do not send it. When present it is re-run here and
   * the submission is refused if the moves do not produce the posted score.
   */
  replay?: string;
}

function isInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** Validates shape only; the plausibility rules are applied by the caller. */
function parsePayload(body: unknown): SubmissionPayload {
  const p = body as Partial<SubmissionPayload> | null;
  // `ai_level` is optional for older clients, which only ever played Monte Carlo.
  const level = p?.ai_level === undefined ? DEFAULT_AI_LEVEL : p.ai_level;
  const valid =
    p !== null &&
    typeof p === 'object' &&
    isPuzzleId(p.puzzle_id) &&
    isInteger(p.elapsed_ms, 0, Number.MAX_SAFE_INTEGER) &&
    isInteger(p.final_score, -10_000, 10_000) &&
    isInteger(p.opponent_score, -10_000, 10_000) &&
    isInteger(p.rounds, 1, 150) &&
    (p.attempts === undefined || isInteger(p.attempts, 1, 10_000)) &&
    isAiLevel(level) &&
    typeof p.client_version === 'string' &&
    p.client_version.length <= 32 &&
    (p.replay === undefined ||
      (typeof p.replay === 'string' && p.replay.length <= MAX_REPLAY_CHARS));
  if (!valid) throw new HttpError(422, 'INVALID_PAYLOAD', 'Malformed submission');
  return { ...(p as SubmissionPayload), ai_level: level as AiLevel };
}

async function audit(
  db: D1Database,
  row: {
    puzzle_id: string;
    user_id: string;
    elapsed_ms: number;
    accepted: boolean;
    reason: string | null;
    created_at: number;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO submissions_audit (puzzle_id, user_id, elapsed_ms, accepted, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.puzzle_id,
      row.user_id,
      row.elapsed_ms,
      row.accepted ? 1 : 0,
      row.reason,
      row.created_at,
    )
    .run();
}

export async function submitScore(
  db: D1Database,
  session: Session,
  body: unknown,
  now = Date.now(),
): Promise<Response> {
  // Parsed first, so an unparseable body cannot be attributed to a puzzle or a
  // time in the audit trail.
  let payload: SubmissionPayload;
  try {
    payload = parsePayload(body);
  } catch (err) {
    await audit(db, {
      puzzle_id: 'unknown', user_id: session.userId, elapsed_ms: 0,
      accepted: false, reason: 'INVALID_PAYLOAD', created_at: now,
    });
    throw err;
  }

  const reject = async (status: number, code: string, message: string): Promise<never> => {
    await audit(db, {
      puzzle_id: payload.puzzle_id, user_id: session.userId, elapsed_ms: payload.elapsed_ms,
      accepted: false, reason: code, created_at: now,
    });
    throw new HttpError(status, code, message);
  };

  const recent = await db
    .prepare(
      'SELECT COUNT(*) AS n FROM submissions_audit WHERE user_id = ? AND created_at > ?',
    )
    .bind(session.userId, now - 3_600_000)
    .first<{ n: number }>();
  if (Number(recent?.n ?? 0) >= RATE_LIMIT_PER_HOUR) {
    await reject(429, 'RATE_LIMITED', 'Too many submissions in the last hour');
  }

  if (payload.puzzle_id !== currentPuzzleId(new Date(now))) {
    await reject(409, 'STALE_PUZZLE', 'That puzzle is no longer the current one');
  }
  if (!isRankedAiLevel(payload.ai_level)) {
    await reject(422, 'UNRANKED_LEVEL', 'Only the three strongest opponents are ranked');
  }
  if (payload.elapsed_ms < MIN_ELAPSED_MS || payload.elapsed_ms > MAX_ELAPSED_MS) {
    await reject(422, 'IMPLAUSIBLE_TIME', 'That time is not plausible');
  }

  // A replay is the strongest evidence the Worker can get, so a wrong one is
  // fatal to the submission rather than merely unverified.
  let verified = false;
  if (payload.replay !== undefined) {
    const check = checkReplay(payload.replay, {
      puzzleId: payload.puzzle_id,
      aiLevel: payload.ai_level,
      seed: seedForPuzzle(payload.puzzle_id),
      finalScore: payload.final_score,
      opponentScore: payload.opponent_score,
      rounds: payload.rounds,
    });
    if (!check.ok) {
      await reject(422, check.reason ?? 'REPLAY_INVALID', check.message ?? 'Replay does not match');
    }
    verified = true;
  }

  const previousAttempts = await db
    .prepare(
      'SELECT elapsed_ms, final_score, opponent_score, attempts, created_at FROM scores WHERE puzzle_id = ? AND user_id = ? AND ai_level = ?',
    )
    .bind(payload.puzzle_id, session.userId, payload.ai_level)
    .all<{ elapsed_ms: number; final_score: number; opponent_score: number; attempts: number; created_at: number }>();

  const historyRows = previousAttempts.results ?? [];
  const submittedAttempts = payload.attempts ?? 1;
  const maxPreviousAttempts = historyRows.reduce((max, r) => Math.max(max, r.attempts ?? 1), 0);
  const attempts = Math.max(historyRows.length + 1, maxPreviousAttempts + 1, submittedAttempts);

  await db
    .prepare(
      `INSERT INTO scores (puzzle_id, user_id, display_name, elapsed_ms, final_score,
                           opponent_score, ai_level, rounds, client_version, replay,
                           verified, attempts, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      payload.puzzle_id, session.userId, session.displayName, payload.elapsed_ms,
      payload.final_score, payload.opponent_score, payload.ai_level, payload.rounds,
      payload.client_version, payload.replay ?? null, verified ? 1 : 0, attempts, now, now,
    )
    .run();

  const payloadDiff = payload.final_score - payload.opponent_score;

  let bestElapsedMs = payload.elapsed_ms;
  let bestFinalScore = payload.final_score;
  let bestOpponentScore = payload.opponent_score;
  let bestCreatedAt = now;
  let improved = true;

  if (historyRows.length > 0) {
    let prevBest = historyRows[0];
    for (let i = 1; i < historyRows.length; i += 1) {
      const row = historyRows[i];
      const rowDiff = row.final_score - row.opponent_score;
      const prevDiff = prevBest.final_score - prevBest.opponent_score;
      if (rowDiff > prevDiff || (rowDiff === prevDiff && row.elapsed_ms < prevBest.elapsed_ms)) {
        prevBest = row;
      }
    }
    const prevDiff = prevBest.final_score - prevBest.opponent_score;
    const isBetterThanPrevious =
      payloadDiff > prevDiff ||
      (payloadDiff === prevDiff && payload.elapsed_ms < prevBest.elapsed_ms);

    if (isBetterThanPrevious) {
      improved = true;
      bestElapsedMs = payload.elapsed_ms;
      bestFinalScore = payload.final_score;
      bestOpponentScore = payload.opponent_score;
      bestCreatedAt = now;
    } else {
      improved = false;
      bestElapsedMs = prevBest.elapsed_ms;
      bestFinalScore = prevBest.final_score;
      bestOpponentScore = prevBest.opponent_score;
      bestCreatedAt = prevBest.created_at;
    }
  }

  await audit(db, {
    puzzle_id: payload.puzzle_id, user_id: session.userId, elapsed_ms: payload.elapsed_ms,
    accepted: true, reason: null, created_at: now,
  });

  const total = await db
    .prepare('SELECT COUNT(*) AS n FROM scores WHERE puzzle_id = ? AND ai_level = ?')
    .bind(payload.puzzle_id, payload.ai_level)
    .first<{ n: number }>();

  const bestDiff = bestFinalScore - bestOpponentScore;

  return json({
    accepted: true,
    improved,
    verified,
    best_elapsed_ms: bestElapsedMs,
    best_final_score: bestFinalScore,
    best_opponent_score: bestOpponentScore,
    attempts,
    ai_level: payload.ai_level,
    rank: await rankOf(db, payload.puzzle_id, payload.ai_level, bestDiff, bestElapsedMs, bestCreatedAt),
    total_entries: Number(total?.n ?? 0),
  });
}

/**
 * `DELETE /api/me` — the account-deletion path (§12.2). Required, not optional.
 *
 * This deletes the account itself, not just its scores: the `user` row goes,
 * and `session` and `account` cascade off it, so the linked providers, the
 * stored provider tokens and the password hash go with it. Anything short of
 * that would make the privacy policy's deletion promise untrue.
 */
export async function deleteMe(db: D1Database, session: Session): Promise<Response> {
  const scores = await db.prepare('DELETE FROM scores WHERE user_id = ?').bind(session.userId).run();
  const audits = await db
    .prepare('DELETE FROM submissions_audit WHERE user_id = ?')
    .bind(session.userId)
    .run();
  await db.prepare('DELETE FROM "user" WHERE id = ?').bind(session.userId).run();
  return json({
    deleted_scores: scores.meta.changes ?? 0,
    deleted_audit: audits.meta.changes ?? 0,
  });
}
