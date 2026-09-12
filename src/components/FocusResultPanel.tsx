import { LEVEL_LABELS, type AgentLevel } from '../ai/base';
import { outcomeCopy, outcomeOf, PLAY_AGAIN_LABEL } from '../copy/outcome';
import type { MatchBreakdown } from '../game/breakdown';
import { formatElapsed } from './Timer';

/**
 * What the focus style shows once the game ends.
 *
 * Focus trades the celebration for the numbers: no confetti, no staged reveal,
 * no board left underneath to re-read. Just the verdict, the score, the round
 * strip that says where the game was won, and the two ways to go again.
 */
export interface FocusResultPanelProps {
  humanWon: boolean;
  draw: boolean;
  elapsedMs: number;
  aiLevel: AgentLevel;
  humanScore: number;
  opponentScore: number;
  breakdown?: MatchBreakdown;
  /** Fresh game — a new deal in Practice. Omitted in Daily where only Restart applies. */
  onNewGame?: () => void;
  /** The same deal again. */
  onRestart?: () => void;
  onBack?: () => void;
  backLabel?: string;
}

export function FocusResultPanel({
  humanWon,
  draw,
  elapsedMs,
  aiLevel,
  humanScore,
  opponentScore,
  breakdown,
  onNewGame,
  onRestart,
  onBack,
  backLabel = 'Back to Home',
}: FocusResultPanelProps) {
  const outcome = outcomeOf(draw, humanWon);
  const opponentName = LEVEL_LABELS[aiLevel] ?? aiLevel;
  const rounds = breakdown?.rounds ?? [];
  const bonus = breakdown?.bonus ?? null;
  const isWin = outcome === 'win';
  const isLose = outcome === 'lose';

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-950/80 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          className={`text-lg font-semibold uppercase tracking-wider sm:text-xl ${
            isWin ? 'text-sky-300' : isLose ? 'text-rose-300' : 'text-neutral-200'
          }`}
        >
          {outcomeCopy(outcome).title}
        </h2>
        <span className="font-mono text-2xl font-black sm:text-3xl">
          <span className={isWin ? 'text-sky-300' : 'text-neutral-300'}>{humanScore}</span>
          <span className="px-1.5 text-neutral-600">–</span>
          <span className={isLose ? 'text-rose-300' : 'text-neutral-400'}>{opponentScore}</span>
        </span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-500">
        vs {opponentName} · {formatElapsed(elapsedMs)}
      </p>

      {rounds.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Match breakdown
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(76px,1fr))] gap-2">
            {rounds.map((r) => (
              <div
                key={r.round}
                className="rounded-lg border border-neutral-800 bg-neutral-900/50 px-2 py-2 text-center"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  Round {r.round}
                </div>
                <div
                  className={`font-mono text-lg font-black ${
                    r.delta > 0 ? 'text-emerald-400' : r.delta < 0 ? 'text-rose-400' : 'text-neutral-400'
                  }`}
                >
                  {r.delta > 0 ? '+' : ''}
                  {r.delta}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {r.you} – {r.opponent}
                </div>
              </div>
            ))}
            {bonus && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-2 py-2 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/80">
                  Bonus
                </div>
                <div
                  className={`font-mono text-lg font-black ${
                    bonus.delta > 0
                      ? 'text-emerald-400'
                      : bonus.delta < 0
                        ? 'text-rose-400'
                        : 'text-neutral-400'
                  }`}
                >
                  {bonus.delta > 0 ? '+' : ''}
                  {bonus.delta}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {bonus.you.points} – {bonus.opponent.points}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {onNewGame ? (
          <>
            <button
              type="button"
              onClick={onNewGame}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 active:scale-[0.98]"
            >
              {PLAY_AGAIN_LABEL}
            </button>
            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900/70 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800 hover:text-white active:scale-[0.98]"
              >
                Restart
              </button>
            )}
          </>
        ) : onRestart ? (
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex flex-1 items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 active:scale-[0.98]"
          >
            Restart
          </button>
        ) : null}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-300"
          >
            {backLabel}
          </button>
        )}
      </div>
    </div>
  );
}
