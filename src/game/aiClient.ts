/**
 * Talks to the AI worker, and survives without it.
 *
 * The worker chunk is imported lazily so it is fetched before the first AI turn
 * rather than on page load (NFR-002). If the worker cannot be created, or a
 * request fails, the client falls back to searching on the main thread and says
 * so — the game always completes (AC-037), it just gets less responsive.
 *
 * The search itself is imported lazily on *both* paths. A static `makeAgent`
 * put every level — MCTS, the alpha-beta ladder and the evaluator behind them —
 * into the initial bundle alongside the worker's own copy, which is exactly the
 * page-load cost NFR-002 exists to avoid. The fallback is a rare path; it can
 * afford to fetch the chunk the worker would have used.
 */

import { Action, type GameState, legalActions } from '../engine';
import type { Agent, AgentLevel } from '../ai/base';
import { AI_MAIN_THREAD_CAP_MS } from '../ai/budget';
import type { AgentBudget } from '../ai/registry';
import type { AiRequest, AiResponse } from '../workers/ai.worker';

export interface AiSpec {
  level: AgentLevel;
  seed?: number;
  /** Overrides for how much work the level may do; the defaults are the game's. */
  budget?: AgentBudget;
}

export type AiMode = 'worker' | 'main-thread';

/**
 * Thrown into pending `choose` calls when the client is disposed — a restart,
 * or React remounting the session. The caller drops the reply; it is not an
 * error the player should ever see.
 */
export class AiDisposed extends Error {}

export interface AiMove {
  action: Action;
  elapsedMs: number;
  mode: AiMode;
  /** True when the move came from a search started before it was asked for. */
  prefetched?: boolean;
  /**
   * True when the search hit its safety cap and answered with less work than
   * the level calls for — this device is slower than any the levels are sized
   * for, and the opponent it faced was correspondingly weaker.
   */
  capped?: boolean;
  simulations?: number;
  steps?: number;
}

/**
 * How long to wait for a worker reply before treating the worker as dead.
 *
 * Comfortably past `AI_SAFETY_CAP_MS`, which is the longest any search is
 * allowed to take: the gap is for a badly contended machine, not for thinking.
 */
const WORKER_REPLY_TIMEOUT_MS = 45000;

const CALIBRATION_LOG_KEY = 'azul:mcts-calibration:v1';
const CALIBRATION_FLAG_KEY = 'azul:mcts-calibration:on';

/** Resolved once: the flag is a debugging switch, not something a game reads. */
let calibrationOn: boolean | null = null;

function calibrationEnabled(): boolean {
  if (calibrationOn === null) {
    try {
      calibrationOn = localStorage.getItem(CALIBRATION_FLAG_KEY) === '1';
    } catch {
      calibrationOn = false;
    }
  }
  return calibrationOn;
}

interface MctsCalibrationEntry {
  recordedAt: string;
  round: number;
  legalActions: number;
  elapsedMs: number;
  simulations: number;
  steps: number;
  actionId: number;
  mode: AiMode;
  prefetched: boolean;
}

export class AiClient {
  private worker: Worker | null = null;
  private fallbackAgent: Agent | null = null;
  private nextId = 1;
  private initialized = false;
  /** Rejectors for in-flight requests, so `dispose` never strands a promise. */
  private readonly pending = new Map<number, (reason: Error) => void>();
  /**
   * A search started before anyone asked for it — see `prefetch`. Keyed by the
   * question it answers, so a mismatched one is dropped rather than misapplied.
   */
  private speculative: { key: string; promise: Promise<AiMove> } | null = null;
  /** The safety-cap warning is worth saying once, not once per move. */
  private warnedCapped = false;
  private watchingPageHide = false;
  private onPageHide: (() => void) | null = null;
  /** Flips to 'main-thread' permanently once the worker has let us down. */
  mode: AiMode = 'worker';

  constructor(private readonly spec: AiSpec) {}

  /** Create the worker if we do not have one yet. Returns null if unavailable. */
  private ensureWorker(): Worker | null {
    if (this.mode === 'main-thread') return null;
    if (this.worker) return this.worker;
    try {
      this.worker = new Worker(new URL('../workers/ai.worker.ts', import.meta.url), {
        type: 'module',
      });
      this.worker.addEventListener('error', () => this.demote());
      this.watchPageHide();
      return this.worker;
    } catch {
      this.demote();
      return null;
    }
  }

  private demote(): void {
    this.mode = 'main-thread';
    this.initialized = false;
    this.speculative = null;
    this.worker?.terminate();
    this.worker = null;
  }

  /**
   * Stop whatever the worker is doing, right now.
   *
   * `terminate()` is the only thing that interrupts a search in progress. Every
   * request still waiting on this worker is rejected as disposed — the caller
   * that wanted an answer asks again on the fresh worker, and a speculative one
   * has nobody waiting.
   */
  private killWorker(): void {
    if (!this.worker) return;
    for (const reject of this.pending.values()) reject(new AiDisposed('AI search cancelled'));
    this.pending.clear();
    this.worker.terminate();
    this.worker = null;
    // The new worker starts without an agent, so the next request carries `init`.
    this.initialized = false;
  }

  /**
   * Never leave a search burning a core behind a page nobody is looking at.
   *
   * A terminated tab still has to tear its workers down, and a worker that is
   * mid-`extreme` is not at a point where it can be torn down cheaply — which
   * is what makes closing the window feel slow, and what leaves a whole core
   * unavailable to everything else on the machine. `pagehide` fires on close,
   * on navigation and on going into the back/forward cache, and the client
   * recreates the worker by itself on the next request if the page comes back.
   */
  private watchPageHide(): void {
    if (this.watchingPageHide || typeof window === 'undefined') return;
    this.watchingPageHide = true;
    this.onPageHide = () => {
      this.speculative = null;
      this.killWorker();
    };
    window.addEventListener('pagehide', this.onPageHide);
  }

  private async onMainThread(state: GameState, player: number): Promise<AiMove> {
    if (!this.fallbackAgent) {
      const { makeAgent } = await import('../ai/registry');
      // A shorter stop-loss here than in the worker: this search freezes the
      // page it is running on, so it must not run for the worker's thirty
      // seconds. An explicit budget from the caller still wins — the bench and
      // the tests set their own.
      this.fallbackAgent = makeAgent(this.spec.level, this.spec.seed, {
        ...this.spec.budget,
        safetyCapMs: this.spec.budget?.safetyCapMs ?? AI_MAIN_THREAD_CAP_MS,
      });
    }
    const started = performance.now();
    const action = this.fallbackAgent.choose(state, player);
    const move: AiMove = {
      action,
      elapsedMs: performance.now() - started,
      mode: 'main-thread',
      capped: this.fallbackAgent.cappedOut === true,
      simulations: this.fallbackAgent.simulations,
      steps: this.fallbackAgent.steps,
    };
    this.recordCalibration(state, move);
    this.warnIfCapped(move);
    return move;
  }

  /**
   * Start searching a position the AI is certain to be asked about next.
   *
   * The opponent's thinking is otherwise dead time bracketed by animations: the
   * player's tile flies home, *then* the search runs, *then* the reply animates.
   * Because the AI's question is fully determined the moment the player commits
   * a move, the search can run underneath the player's own placement animation
   * instead — on a quick device it is finished before the animation is, and on a
   * slow one the animation still pays for a second of it. That is what makes a
   * fixed, device-independent work budget affordable (see `src/ai/budget.ts`).
   *
   * Only ever called with the exact position `choose` will be handed, so no
   * search is wasted and the agent's own RNG stays on the same sequence it would
   * have followed without prefetching. A miss is safe regardless — the key check
   * drops the answer and `choose` searches again.
   */
  prefetch(state: GameState, player: number): void {
    // On the main thread this would freeze the very animation it means to hide
    // behind, so the fallback path just waits its turn as before.
    if (this.mode !== 'worker' || this.speculative) return;
    const key = this.keyFor(state, player);
    const promise = this.choose(state, player, true);
    // Nothing awaits this yet; a rejection here must not surface as unhandled.
    promise.catch(() => undefined);
    this.speculative = { key, promise };
  }

  private keyFor(state: GameState, player: number): string {
    return `${player}:${JSON.stringify(state.toDict(true))}`;
  }

  /** Ask for a move. Never rejects for worker reasons — it falls back instead. */
  async choose(state: GameState, player: number, speculative = false): Promise<AiMove> {
    if (!speculative && this.speculative) {
      const pending = this.speculative;
      this.speculative = null;
      if (pending.key === this.keyFor(state, player)) {
        const move = await pending.promise;
        const prefetched = { ...move, prefetched: true };
        this.recordCalibration(state, prefetched);
        return prefetched;
      }
      // A different question than the one in flight — an undo, or a restart.
      //
      // The search cannot be asked to stop: `agent.choose` is a synchronous
      // call inside the worker, so the worker never reaches its message queue
      // until it is done. Letting it run costs a full core for as long as the
      // level's budget takes (`extreme` spends over a million engine steps in a
      // late round, enough to reach its own thirty-second stop-loss),
      // and because the worker answers serially the real question would queue
      // up *behind* the answer nobody wants. Killing the worker is the only
      // thing that actually stops it; a fresh one costs a few milliseconds and
      // re-sends `init` on its first request.
      this.killWorker();
    }

    const worker = this.ensureWorker();
    if (!worker) return this.onMainThread(state, player);

    const id = this.nextId++;
    const request: AiRequest = {
      id,
      init: this.initialized ? undefined : this.spec,
      state: state.toDict(true),
      player,
    };

    try {
      const response = await new Promise<AiResponse>((resolve, reject) => {
        const onMessage = (event: MessageEvent<AiResponse>) => {
          if (event.data.id !== id) return;
          cleanup();
          resolve(event.data);
        };
        const onError = () => {
          cleanup();
          reject(new Error('the AI worker failed'));
        };
        /*
          The backstop for a worker that goes quiet without failing.

          Every search answers: the agents bound themselves with
          `AI_SAFETY_CAP_MS` and return their best move so far. So a reply that
          has not arrived well after that deadline does not mean "still
          thinking", it means the worker is gone — reclaimed under memory
          pressure, or a message lost — and those do not always fire `error`.
          Without this the promise simply never settles: the session sits on
          `ai-thinking` forever, with undo disabled because the AI is supposedly
          mid-move, and the only way out is reloading the page.
        */
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error('the AI worker stopped answering'));
        }, WORKER_REPLY_TIMEOUT_MS);
        const cleanup = () => {
          clearTimeout(timer);
          this.pending.delete(id);
          worker.removeEventListener('message', onMessage);
          worker.removeEventListener('error', onError);
        };
        this.pending.set(id, (reason) => {
          cleanup();
          reject(reason);
        });
        worker.addEventListener('message', onMessage);
        worker.addEventListener('error', onError);
        worker.postMessage(request);
      });

      if (!response.ok) throw new Error(response.error);
      this.initialized = true;
      const move: AiMove = {
        action: Action.fromId(response.actionId),
        elapsedMs: response.elapsedMs,
        mode: 'worker',
        capped: response.capped,
        simulations: response.simulations,
        steps: response.steps,
      };
      if (!speculative) this.recordCalibration(state, move);
      this.warnIfCapped(move);
      return move;
    } catch (err) {
      if (err instanceof AiDisposed) throw err; // the caller is going away
      // A worker that dies mid-game hands the rest of the game to this thread.
      this.demote();
      return this.onMainThread(state, player);
    }
  }

  /**
   * Say so, once, when a search answered with less work than its level calls for.
   *
   * Every other level is sized so that even a device several times slower than
   * the bench machine finishes in full, so this firing for one of them means the
   * player is quietly facing a weaker opponent than the level promises. For
   * `extreme` in a late round it is expected rather than exceptional — the work
   * budget there is more than the stop-loss buys on any hardware measured (see
   * `src/ai/budget.ts`) — and the message names the mode, because the fallback
   * path caps far shorter than the worker and will trip it far sooner.
   */
  private warnIfCapped(move: AiMove): void {
    if (!move.capped || this.warnedCapped) return;
    this.warnedCapped = true;
    console.warn(
      `AI search hit its safety cap after ${move.elapsedMs.toFixed(0)}ms ` +
        `(${move.mode}); the ${this.spec.level} opponent is playing below ` +
        `strength on this device.`,
    );
  }

  /**
   * Persist one JSON record per manually played Extreme move for calibration.
   *
   * Off unless someone asks for it. The log is re-parsed, re-serialized and
   * written back in full on every move, so once it is a few hundred entries
   * deep it is a growing synchronous main-thread cost — paid in the middle of a
   * game, by every player, for a measurement only the person tuning the budgets
   * ever reads — and it is the same cost in dev, where it sat in the way of
   * every measurement taken to decide whether something else was slow.
   * `localStorage.setItem('azul:mcts-calibration:on', '1')` turns it on, in any
   * build, for as long as that key is set.
   */
  private recordCalibration(state: GameState, move: AiMove): void {
    if (!calibrationEnabled()) return;
    if (this.spec.level !== 'extreme' || move.simulations === undefined || move.steps === undefined) {
      return;
    }
    const entry: MctsCalibrationEntry = {
      recordedAt: new Date().toISOString(),
      round: state.round_num,
      legalActions: legalActions(state).length,
      elapsedMs: Number(move.elapsedMs.toFixed(3)),
      simulations: move.simulations,
      steps: move.steps,
      actionId: move.action.actionId,
      mode: move.mode,
      prefetched: move.prefetched === true,
    };
    console.info('[MCTS calibration]', JSON.stringify(entry));
    try {
      const previous = JSON.parse(localStorage.getItem(CALIBRATION_LOG_KEY) ?? '[]');
      const log = Array.isArray(previous) ? previous : [];
      log.push(entry);
      localStorage.setItem(CALIBRATION_LOG_KEY, JSON.stringify(log.slice(-1000)));
    } catch {
      // Console logging remains available when storage is blocked or full.
    }
  }

  dispose(): void {
    this.speculative = null;
    for (const reject of this.pending.values()) reject(new AiDisposed('AI client disposed'));
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
    this.initialized = false;
    if (this.onPageHide && typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.onPageHide);
    }
    this.onPageHide = null;
    this.watchingPageHide = false;
  }
}
