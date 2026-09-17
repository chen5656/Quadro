/** Score submission for browser guests. Failed attempts stay in memory only. */
import { useCallback, useRef, useState } from 'react';
import { ApiError, CLIENT_VERSION, type ScoreSubmission, postScore, withBackoff } from '../api/client';

export type SubmissionState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'posted'; rank: number; elapsedMs: number; totalEntries: number }
  | { kind: 'not-improved'; bestElapsedMs: number }
  | { kind: 'failed'; message: string; code: string }
  | { kind: 'discarded' };

export interface Submitter {
  state: SubmissionState;
  submit: (attempt: Omit<ScoreSubmission, 'client_version'>) => Promise<void>;
  retry: () => Promise<void>;
  discard: () => void;
  reset: () => void;
}

export function useSubmission(): Submitter {
  const [state, setState] = useState<SubmissionState>({ kind: 'idle' });
  const held = useRef<ScoreSubmission | null>(null);
  const inFlight = useRef(false);
  const generation = useRef(0);

  const send = useCallback(async () => {
    const attempt = held.current;
    if (!attempt || inFlight.current) return;
    const current = generation.current;
    inFlight.current = true;
    setState({ kind: 'submitting' });
    try {
      const result = await withBackoff(() => postScore(attempt));
      if (current !== generation.current) return;
      held.current = null;
      setState(result.improved
        ? { kind: 'posted', rank: result.rank, elapsedMs: result.best_elapsed_ms, totalEntries: result.total_entries }
        : { kind: 'not-improved', bestElapsedMs: result.best_elapsed_ms });
    } catch (err) {
      if (current !== generation.current) return;
      const error = err instanceof ApiError ? err : null;
      setState({ kind: 'failed', code: error?.code ?? 'INTERNAL', message: explain(error) });
    } finally {
      if (current === generation.current) inFlight.current = false;
    }
  }, []);

  const submit = useCallback(async (attempt: Omit<ScoreSubmission, 'client_version'>) => {
    if (inFlight.current) return;
    held.current = { ...attempt, client_version: CLIENT_VERSION };
    await send();
  }, [send]);

  const clear = useCallback((kind: 'idle' | 'discarded') => {
    generation.current += 1;
    inFlight.current = false;
    held.current = null;
    setState({ kind });
  }, []);
  const discard = useCallback(() => clear('discarded'), [clear]);
  const reset = useCallback(() => clear('idle'), [clear]);
  return { state, submit, retry: send, discard, reset };
}

function explain(error: ApiError | null): string {
  switch (error?.code) {
    case 'OFFLINE':
      return "You're offline, so this time can't be recorded right now.";
    case 'STALE_PUZZLE':
      return "This attempt belongs to yesterday's puzzle, so it can't be posted.";
    case 'IMPLAUSIBLE_TIME':
      return 'The server rejected this time as implausible.';
    case 'INVALID_PAYLOAD':
      return 'The server rejected this attempt as malformed.';
    case 'RATE_LIMITED':
      return "You've submitted a lot in the last hour. Try again shortly.";
    case 'UNAUTHENTICATED':
      return 'Could not start your guest session. Allow cookies for this site and retry.';
    default:
      return error?.message ?? 'Something went wrong posting your time.';
  }
}
