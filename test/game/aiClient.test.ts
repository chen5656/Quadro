// @vitest-environment jsdom
/**
 * The AI client's speculative search (`prefetch`).
 *
 * Levels spend a fixed amount of work per move rather than a slice of clock, so
 * that the opponent is the same on every device (see `src/ai/budget.ts`). What
 * pays for that is starting the search under the animation that precedes it —
 * which is only sound if a prefetched answer is used for exactly the question it
 * answers, and dropped otherwise — and, since a search cannot be interrupted
 * from inside, that dropping it actually stops it.
 *
 * jsdom rather than node: the client watches `pagehide` to make sure it never
 * leaves a search running behind a page nobody is looking at.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuadroGame, applyAction, legalActions } from '../../src/engine';
import { AI_MAIN_THREAD_CAP_MS } from '../../src/ai/budget';
import { AiClient } from '../../src/game/aiClient';
import type { AiRequest, AiResponse } from '../../src/workers/ai.worker';

/** A worker that records what it was asked and answers on a later task. */
class FakeWorker implements Pick<Worker, 'postMessage' | 'terminate'> {
  static last: FakeWorker | null = null;
  /** When set, the worker takes every request and never answers any of them. */
  static mute = false;
  /** Every worker the client has built, oldest first. */
  static all: FakeWorker[] = [];
  readonly requests: AiRequest[] = [];
  terminated = false;
  private readonly listeners = new Set<(event: MessageEvent<AiResponse>) => void>();

  constructor() {
    FakeWorker.last = this;
    FakeWorker.all.push(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'message') this.listeners.add(listener as (e: MessageEvent<AiResponse>) => void);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === 'message') {
      this.listeners.delete(listener as (e: MessageEvent<AiResponse>) => void);
    }
  }

  postMessage(request: AiRequest): void {
    this.requests.push(request);
    // A worker reclaimed under memory pressure takes the message and is simply
    // never heard from again — no reply, and no `error` event either.
    if (FakeWorker.mute) return;
    // The real worker replies on a later task; so does this one.
    setTimeout(() => {
      const reply: AiResponse = {
        id: request.id,
        ok: true,
        actionId: 0,
        elapsedMs: 1,
        capped: false,
      };
      for (const listener of this.listeners) {
        listener({ data: reply } as MessageEvent<AiResponse>);
      }
    }, 0);
  }

  terminate(): void {
    this.terminated = true;
    this.listeners.clear();
  }
}

function install(): void {
  FakeWorker.all = [];
  FakeWorker.mute = false;
  vi.stubGlobal('Worker', FakeWorker);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWorker.last = null;
  FakeWorker.all = [];
  FakeWorker.mute = false;
});

describe('prefetch', () => {
  it('answers the question it was primed with, without searching twice', async () => {
    install();
    const game = new QuadroGame(31);
    const client = new AiClient({ level: 'medium', seed: 1 });

    client.prefetch(game.state, game.state.current);
    const worker = FakeWorker.last!;
    expect(worker.requests).toHaveLength(1);

    const move = await client.choose(game.state, game.state.current);
    expect(move.prefetched).toBe(true);
    // The whole point: the search ran once, ahead of the ask.
    expect(worker.requests).toHaveLength(1);
    client.dispose();
  });

  it('drops a prefetch that answers a different position, and stops it', async () => {
    install();
    const game = new QuadroGame(31);
    const stale = game.state.clone();

    const client = new AiClient({ level: 'medium', seed: 1 });
    client.prefetch(stale, stale.current);
    const stranded = FakeWorker.last!;

    // The position moves on before the answer is collected.
    const moved = game.state.clone();
    applyAction(moved, legalActions(moved)[0]);

    const move = await client.choose(moved, moved.current);
    expect(move.prefetched).toBeUndefined();

    /*
      The stale search is not merely ignored, it is stopped. A search is a
      synchronous call inside the worker, so the worker cannot be asked to
      abandon one: left alone it holds a core for the whole of the level's
      budget and — because it answers serially — the question that is actually
      wanted queues up behind the answer nobody will read. Terminating is what
      makes the stale search cost nothing.
    */
    expect(stranded.terminated).toBe(true);
    expect(stranded.requests).toHaveLength(1);

    // The real question went to a fresh worker, which has no agent yet and so
    // is sent the spec again.
    expect(FakeWorker.all).toHaveLength(2);
    const replacement = FakeWorker.all[1];
    expect(replacement.requests).toHaveLength(1);
    expect(replacement.requests[0].init).toEqual({ level: 'medium', seed: 1, budget: undefined });
    client.dispose();
  });

  it('stops the search when the page goes away', async () => {
    install();
    const game = new QuadroGame(31);
    const client = new AiClient({ level: 'medium', seed: 1 });

    client.prefetch(game.state, game.state.current);
    const worker = FakeWorker.last!;
    expect(worker.terminated).toBe(false);

    // Closing the tab, navigating away, or going into the back/forward cache.
    window.dispatchEvent(new Event('pagehide'));

    expect(worker.terminated).toBe(true);
    client.dispose();
  });

  it('does not stack speculative searches', () => {
    install();
    const game = new QuadroGame(31);
    const client = new AiClient({ level: 'medium', seed: 1 });

    client.prefetch(game.state, game.state.current);
    client.prefetch(game.state, game.state.current);
    expect(FakeWorker.last!.requests).toHaveLength(1);
    client.dispose();
  });
});

describe('backstops', () => {
  it('gives up on a worker that stops answering, and finishes the move anyway', async () => {
    install();
    vi.useFakeTimers();
    const game = new QuadroGame(31);
    // `easy` so the main-thread fallback answers immediately once we get there.
    const client = new AiClient({ level: 'easy', seed: 1 });

    FakeWorker.mute = true;
    const pending = client.choose(game.state, game.state.current);
    const worker = FakeWorker.last!;
    expect(worker.requests).toHaveLength(1);

    // Nothing has come back, and nothing ever will. Without a timeout this
    // promise never settles and the session sits on 'ai-thinking' for good.
    await vi.advanceTimersByTimeAsync(46_000);

    const move = await pending;
    expect(move.mode).toBe('main-thread');
    expect(worker.terminated).toBe(true);
    expect(legalActions(game.state).map((a) => a.actionId)).toContain(move.action.actionId);
    client.dispose();
  });

  it('caps a main-thread search far shorter than a worker one', async () => {
    // No `Worker` at all: every search is on the UI thread, where a long one is
    // a frozen page rather than a busy background thread.
    vi.stubGlobal('Worker', undefined);
    const game = new QuadroGame(31);
    /*
      `extreme` on purpose, and a real search rather than a stub: its work
      budget is more than any stop-loss buys (see `src/ai/budget.ts`), so it
      runs until it is stopped. That makes it the one level that actually
      measures which cap is in force — with the worker's thirty seconds wired
      here by mistake, this move would take six times as long as it may.
    */
    const client = new AiClient({ level: 'extreme', seed: 1 });

    const move = await client.choose(game.state, game.state.current);
    expect(move.mode).toBe('main-thread');
    expect(move.capped).toBe(true);
    // The cap is checked between simulations, so it overruns it slightly.
    expect(move.elapsedMs).toBeLessThan(AI_MAIN_THREAD_CAP_MS * 1.5);
    client.dispose();
  }, 40_000);
});
