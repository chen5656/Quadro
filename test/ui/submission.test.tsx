import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSubmission } from '../../src/game/useSubmission';

const ATTEMPT = {
  puzzle_id: '2026-08-28', elapsed_ms: 461_230, final_score: 64,
  opponent_score: 51, rounds: 5, ai_level: 'extreme',
};
const RESULT = { accepted: true, improved: true, best_elapsed_ms: 461_230, rank: 1, total_entries: 38 };
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});
let fetchMock: ReturnType<typeof vi.fn>;
let scoreMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  scoreMock = vi.fn(() => Promise.resolve(response(200, RESULT)));
  fetchMock = vi.fn((url: string) => url === '/api/guest'
    ? Promise.resolve(response(200, { displayName: 'player-123456', imageUrl: null }))
    : scoreMock());
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('guest score submission', () => {
  it('posts without identity or sign-in and includes cookies', async () => {
    const { result } = renderHook(() => useSubmission());
    await act(() => result.current.submit(ATTEMPT));
    expect(result.current.state).toEqual({ kind: 'posted', rank: 1, elapsedMs: 461_230, totalEntries: 38 });
    const [, init] = fetchMock.mock.calls.find(([url]) => url === '/api/scores')!;
    expect(JSON.parse(init.body)).toEqual({ ...ATTEMPT, client_version: '1.0.0' });
    expect(init.credentials).toBe('include');
    await act(() => result.current.retry());
    expect(scoreMock).toHaveBeenCalledTimes(1);
  });

  it('reports a slower attempt as not improved', async () => {
    scoreMock.mockResolvedValue(response(200, { ...RESULT, improved: false, best_elapsed_ms: 400_000 }));
    const { result } = renderHook(() => useSubmission());
    await act(() => result.current.submit(ATTEMPT));
    expect(result.current.state).toEqual({ kind: 'not-improved', bestElapsedMs: 400_000 });
  });

  it.each([
    [409, 'STALE_PUZZLE', /yesterday/i],
    [429, 'RATE_LIMITED', /last hour/i],
    [422, 'IMPLAUSIBLE_TIME', /implausible/i],
  ])('explains %s errors without retrying them', async (status, code, message) => {
    scoreMock.mockImplementation(() => Promise.resolve(response(status as number, { error: { code } })));
    const { result } = renderHook(() => useSubmission());
    await act(() => result.current.submit(ATTEMPT));
    expect(result.current.state).toMatchObject({ kind: 'failed', code, message: expect.stringMatching(message as RegExp) });
    expect(scoreMock).toHaveBeenCalledTimes(1);
  });

  it('keeps an offline attempt in memory for retry', async () => {
    vi.useFakeTimers();
    scoreMock.mockRejectedValue(new TypeError('offline'));
    const { result } = renderHook(() => useSubmission());
    await act(async () => {
      const pending = result.current.submit(ATTEMPT);
      await vi.runAllTimersAsync();
      await pending;
    });
    expect(result.current.state).toMatchObject({ kind: 'failed', code: 'OFFLINE' });
    scoreMock.mockImplementation(() => Promise.resolve(response(200, RESULT)));
    await act(() => result.current.retry());
    expect(result.current.state).toMatchObject({ kind: 'posted' });
  });

  it('does not restore failed attempts after a remount', async () => {
    scoreMock.mockResolvedValue(response(422, { error: { code: 'INVALID_PAYLOAD' } }));
    const first = renderHook(() => useSubmission());
    await act(() => first.result.current.submit(ATTEMPT));
    first.unmount();
    const second = renderHook(() => useSubmission());
    expect(second.result.current.state).toEqual({ kind: 'idle' });
    expect(scoreMock).toHaveBeenCalledTimes(1);
  });

  it('discards a failed attempt', async () => {
    scoreMock.mockResolvedValue(response(422, { error: { code: 'INVALID_PAYLOAD' } }));
    const { result } = renderHook(() => useSubmission());
    await act(() => result.current.submit(ATTEMPT));
    act(() => result.current.discard());
    await act(() => result.current.retry());
    expect(result.current.state).toEqual({ kind: 'discarded' });
    expect(scoreMock).toHaveBeenCalledTimes(1);
  });
});
