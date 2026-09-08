import { useEffect, useMemo, useRef, useState } from 'react';
import { LEVEL_LABELS, type AgentLevel } from '../ai';
import { RobotAvatar } from './RobotAvatar';
import { SITE_NAME } from '../site';
import { BonusTable } from './BonusTable';
import { formatElapsed } from './Timer';
import type { SubmissionState } from '../game/useSubmission';
import { isRankedLevel } from '../daily/levels';
import { Link } from '../router';
import { PLAY_AGAIN_LABEL } from '../copy/outcome';
import {
  bestRound,
  roundsWon,
  type MatchBreakdown,
} from '../game/breakdown';
import { sfx } from '../audio';
import { useGameStyle } from '../context/GameStyleContext';
import { useCountUp, usePrefersReducedMotion, useTimeline } from './resultMotion';

/**
 * The screen the player lands on the moment a game ends.
 *
 * It has one job beyond reporting the score: make the next game feel like the
 * obvious thing to do. So the verdict lands first, the score counts itself up,
 * the three numbers that say *how* it went drop in, and only then does the
 * play-again button light up — by which point it is the brightest thing on the
 * screen. Everything is staged rather than simultaneous, because a screen that
 * arrives all at once is a screen you have already finished reading.
 *
 * Layout is one component at three sizes rather than three components: the
 * player badges sit either side of the verdict from `md` up, and collapse into
 * a single row under it below that (`md:contents` promotes them into the grid
 * without duplicating the markup).
 */

export interface GameResultCardProps {
  humanWon: boolean;
  draw?: boolean;
  elapsedMs: number;
  aiLevel: AgentLevel;
  humanScore: number;
  opponentScore: number;
  /** Round swings and end-game bonuses. Omitted means no breakdown. */
  breakdown?: MatchBreakdown;
  /** Leaderboard submission state (for daily games) */
  submissionState?: SubmissionState;
  /** Whether the game difficulty was ranked */
  ranked?: boolean;
  /**
   * The share payload for this game: a link that replays it, plus the recap
   * line that goes next to the link.
   *
   * Passed in rather than derived here, because only the route holds the
   * `QuadroGame` the replay is encoded from. Absent means the game could not
   * be encoded (absurdly long), and the share control is hidden rather than
   * offering a link to nothing.
   */
  share?: { url: string; text: string } | null;
  onPlayAgain: () => void;
  onWatchReplay?: () => void;
  onBack?: () => void;
  backLabel?: string;
  onSwitchToRanked?: () => void;
  onRetrySubmit?: () => void;
  onDiscardSubmit?: () => void;
  onOpenSignIn?: () => void;
}

/** When each beat of the reveal fires, in ms after the card mounts. */
const BEATS = [80, 420, 1250, 1650] as const;
const [BEAT_BADGES, BEAT_SCORE, BEAT_STATS, BEAT_CTA] = [1, 2, 3, 4];

type Tone = 'win' | 'lose' | 'draw';

const TONE_ACCENT: Record<Tone, string> = {
  win: 'text-sky-300',
  lose: 'text-rose-300',
  draw: 'text-neutral-200',
};

/** A closing line that reacts to how the game actually went. */
function verdictLine(tone: Tone, margin: number): string {
  if (tone === 'draw') return 'Dead level. One more decides it.';
  if (tone === 'win') {
    if (margin <= 3) return 'Won by a whisker. Nerves of steel.';
    if (margin >= 20) return 'Not close. That was a dismantling.';
    return 'Sharp moves. Well played.';
  }
  if (margin <= 3) return 'That close. One row swings it back.';
  if (margin >= 20) return 'Rough one. Rebuild and go again.';
  return 'So near. Run it back.';
}

export function GameResultCard({
  humanWon,
  draw = false,
  elapsedMs,
  aiLevel,
  humanScore,
  opponentScore,
  breakdown,
  submissionState,
  ranked = isRankedLevel(aiLevel),
  share = null,
  onPlayAgain,
  onWatchReplay,
  onBack,
  backLabel = 'Back to Home',
  onSwitchToRanked,
  onRetrySubmit,
  onOpenSignIn,
}: GameResultCardProps) {
  const [copied, setCopied] = useState(false);
  const { style } = useGameStyle();
  const reduced = usePrefersReducedMotion();
  const skip = reduced || style === 'focus';

  const opponentName = LEVEL_LABELS[aiLevel] ?? aiLevel;
  const timeFormatted = formatElapsed(elapsedMs);
  const tone: Tone = draw ? 'draw' : humanWon ? 'win' : 'lose';
  const isWin = tone === 'win';
  const isLose = tone === 'lose';
  const margin = humanScore - opponentScore;

  const stage = useTimeline(BEATS, skip);
  const rounds = breakdown?.rounds;
  const bonus = breakdown?.bonus ?? null;
  const best = useMemo(() => (rounds ? bestRound(rounds) : null), [rounds]);
  const won = useMemo(() => (rounds ? roundsWon(rounds) : 0), [rounds]);

  // Sound rides the same clock as the animation. The win/lose sting already
  // plays when the game ends (useGameSession), so this layer only adds the
  // counter, the stats landing and the button lighting up.
  const countTick = (_v: number, p: number) => {
    sfx('score', { rate: 0.92 + p * 0.55, gain: 0.3 });
  };
  const scoreCounting = stage >= BEAT_SCORE;
  const yourScore = useCountUp(humanScore, scoreCounting, skip ? 0 : 900, skip ? undefined : countTick);
  const theirScore = useCountUp(opponentScore, scoreCounting, skip ? 0 : 900);

  const chimed = useRef(false);
  useEffect(() => {
    if (skip || chimed.current) return;
    if (stage >= BEAT_STATS) {
      chimed.current = true;
      sfx(isWin ? 'bonus' : 'ui', { gain: 0.4 });
    }
  }, [stage, skip, isWin]);

  const ctaChimed = useRef(false);
  useEffect(() => {
    if (skip || ctaChimed.current) return;
    if (stage >= BEAT_CTA) {
      ctaChimed.current = true;
      sfx('ui', { gain: 0.3, rate: 1.15 });
    }
  }, [stage, skip]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${4 + (i * 92) / 18 + Math.random() * 4}%`,
        dx: `${(Math.random() - 0.5) * 120}px`,
        dy: `${180 + Math.random() * 220}px`,
        rot: `${(Math.random() - 0.5) * 900}deg`,
        dur: `${2.6 + Math.random() * 1.8}s`,
        delay: `${Math.random() * 0.9}s`,
        hue: i % 3,
      })),
    [],
  );

  const handleShareClick = async () => {
    if (!share) return;
    const shareData = {
      title: `${SITE_NAME} — Daily Challenge`,
      text: share.text,
      url: share.url,
    };
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Share dismissed or failed, fallback to copy
      }
    }
    // Only claim the link was copied once the write has actually resolved: a
    // refused clipboard used to leave the button saying "Copied!" over an
    // empty clipboard.
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(`${share.text}\n${share.url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Nothing to say beyond leaving the button as it was.
      }
    }
  };

  const shellTint = isWin
    ? 'border-sky-900/60 bg-[#080d14]/95'
    : isLose
      ? 'border-rose-950/60 bg-[#100a0d]/95'
      : 'border-neutral-800 bg-[#0c0e12]/95';

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Context row: is this game ranked, and a way to brag about it. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!ranked ? (
          <div className="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/90 px-3.5 py-1.5 text-xs text-neutral-300 shadow-sm backdrop-blur-sm sm:text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-xs">
              🏆
            </span>
            <span className="font-semibold text-neutral-200">
              {opponentName} games aren&apos;t ranked
            </span>
            <span className="hidden text-neutral-500 sm:inline">•</span>
            <span className="hidden text-neutral-400 sm:inline">
              Expert, Master &amp; Extreme count toward today&apos;s leaderboard.
            </span>
            {onSwitchToRanked && (
              <button
                type="button"
                onClick={onSwitchToRanked}
                className="ml-1 inline-flex items-center gap-1 font-semibold text-amber-400 transition hover:text-amber-300 hover:underline"
              >
                Play Expert &rarr;
              </button>
            )}
          </div>
        ) : (
          <div className="flex w-fit max-w-full flex-wrap items-center gap-2 rounded-full border border-sky-900/60 bg-sky-950/40 px-3.5 py-1.5 text-xs text-sky-200 shadow-sm backdrop-blur-sm sm:text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-xs">
              🏆
            </span>
            <span className="font-semibold text-sky-300">Ranked Game</span>
            <span className="hidden text-sky-500/60 sm:inline">•</span>
            <span className="hidden text-neutral-300 sm:inline">
              Counts toward today&apos;s {opponentName} leaderboard
            </span>
          </div>
        )}

        {share && (
          <button
            type="button"
            onClick={handleShareClick}
            title="Share this result"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-200 shadow-sm transition hover:bg-neutral-800 hover:text-white sm:text-sm"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 stroke-current"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span>{copied ? 'Copied!' : 'Share result'}</span>
          </button>
        )}
      </div>

      <div
        className={`relative overflow-hidden rounded-2xl border px-4 py-5 shadow-2xl backdrop-blur-md sm:rounded-3xl sm:px-7 sm:py-7 lg:px-10 lg:py-9 ${shellTint}`}
      >
        {/* Backdrop: a colour wash, plus slow rays behind a win. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 select-none"
          style={{
            background: isWin
              ? 'radial-gradient(circle 420px at 50% 22%, rgba(56,189,248,0.22), transparent 72%), radial-gradient(circle 700px at 50% 60%, rgba(14,165,233,0.08), transparent 80%)'
              : isLose
                ? 'radial-gradient(circle 420px at 50% 22%, rgba(244,63,94,0.16), transparent 72%)'
                : 'radial-gradient(circle 420px at 50% 22%, rgba(148,163,184,0.12), transparent 72%)',
          }}
        />
        {isWin && !skip && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/3 select-none opacity-[0.13]"
          >
            <div
              className="azul-res-rays h-full w-full"
              style={{
                background:
                  'repeating-conic-gradient(from 0deg, rgba(125,211,252,0.9) 0deg 8deg, transparent 8deg 24deg)',
                maskImage: 'radial-gradient(circle, black 10%, transparent 68%)',
                WebkitMaskImage: 'radial-gradient(circle, black 10%, transparent 68%)',
              }}
            />
          </div>
        )}
        {isWin && !skip && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-full select-none overflow-hidden">
            {confetti.map((c) => (
              <span
                key={c.id}
                className={`azul-res-confetti absolute top-0 h-2 w-1 rounded-[1px] ${
                  c.hue === 0 ? 'bg-sky-300' : c.hue === 1 ? 'bg-amber-300' : 'bg-white/80'
                }`}
                style={
                  {
                    left: c.left,
                    '--dx': c.dx,
                    '--dy': c.dy,
                    '--rot': c.rot,
                    '--dur': c.dur,
                    '--d': c.delay,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        )}

        <div className="relative flex flex-col items-center gap-5 sm:gap-6">
          {/* Hero: verdict in the middle, the two players either side on md+. */}
          <div className="grid w-full items-center gap-4 sm:gap-5 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-8">
            <div className="order-2 flex items-start justify-center gap-8 sm:gap-12 md:contents">
              <PlayerBadge
                name="You"
                score={yourScore}
                avatar={
                  <svg viewBox="0 0 24 24" className="h-3/5 w-3/5 fill-current text-neutral-300" aria-hidden="true">
                    <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.5-8 5.5V22h16v-2.5c0-3-3.6-5.5-8-5.5Z" />
                  </svg>
                }
                accent={isWin ? 'sky' : isLose ? 'muted' : 'neutral'}
                align="md:order-1 md:justify-self-end"
                shown={skip || stage >= BEAT_BADGES}
                delay="0.05s"
              />
              <PlayerBadge
                name={opponentName}
                score={theirScore}
                avatar={<RobotAvatar level={aiLevel} className="h-full w-full object-contain" />}
                accent={isLose ? 'rose' : 'muted'}
                align="md:order-3 md:justify-self-start"
                shown={skip || stage >= BEAT_BADGES}
                delay="0.15s"
              />
            </div>

            <div className="order-1 flex min-w-0 flex-col items-center px-1 text-center md:order-2 md:px-3">
              <div
                aria-hidden="true"
                className={`${skip ? '' : 'azul-res-pop '}select-none text-3xl sm:text-4xl lg:text-5xl`}
                style={{ '--d': '0.05s' } as React.CSSProperties}
              >
                {isWin ? '🏆' : isLose ? '🤖' : '🤝'}
              </div>
              <h2
                className={`${skip ? '' : 'azul-res-slam '}mt-1 select-none font-black uppercase leading-none tracking-tight text-[clamp(2rem,8vw,3.25rem)] md:text-5xl lg:text-6xl xl:text-7xl ${
                  isWin
                    ? 'azul-res-sheen bg-[linear-gradient(100deg,#e0f2fe_0%,#7dd3fc_35%,#ffffff_50%,#38bdf8_65%,#0ea5e9_100%)] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(56,189,248,0.45)]'
                    : isLose
                      ? 'bg-gradient-to-b from-rose-100 via-rose-300 to-rose-500 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(244,63,94,0.4)]'
                      : 'bg-gradient-to-b from-neutral-100 via-neutral-300 to-neutral-500 bg-clip-text text-transparent'
                }`}
                style={{ '--d': '0.12s' } as React.CSSProperties}
              >
                {draw ? 'DRAW!' : isWin ? 'YOU WIN!' : 'GAME OVER'}
              </h2>

              <div
                className={`${skip || stage >= BEAT_SCORE ? '' : 'opacity-0 '}${skip ? '' : 'azul-res-rise '}mt-2 flex items-baseline justify-center gap-3 font-mono text-[clamp(1.6rem,6vw,2.5rem)] font-black md:text-4xl lg:text-5xl leading-none`}
                style={{ '--d': '0.1s' } as React.CSSProperties}
              >
                <span className={isWin ? 'text-sky-300' : isLose ? 'text-neutral-300' : 'text-neutral-200'}>
                  {yourScore}
                </span>
                <span className="text-neutral-600">–</span>
                <span className={isLose ? 'text-rose-300' : 'text-neutral-400'}>{theirScore}</span>
              </div>

              <p className="mt-2 text-xs text-neutral-400 sm:text-sm">
                {draw ? 'Tied with' : isWin ? 'You beat' : 'You lost to'} {opponentName} in{' '}
                <span className={`font-mono font-bold ${TONE_ACCENT[tone]}`}>{timeFormatted}</span>
              </p>
            </div>
          </div>

          {/* The three numbers that say how it went. */}
          <div className="order-3 grid w-full max-w-3xl grid-cols-3 gap-2 sm:gap-3">
            <StatTile
              icon={margin >= 0 ? '▲' : '▼'}
              iconClass={margin > 0 ? 'text-emerald-400' : margin < 0 ? 'text-rose-400' : 'text-neutral-400'}
              value={`${margin > 0 ? '+' : ''}${margin}`}
              label="Final margin"
              shown={skip || stage >= BEAT_STATS}
              delay="0s"
            />
            <StatTile
              icon="📊"
              value={rounds && rounds.length > 0 ? `${won} of ${rounds.length}` : '—'}
              label="Rounds won"
              shown={skip || stage >= BEAT_STATS}
              delay="0.08s"
            />
            <StatTile
              icon="⭐"
              value={best ? `${best.delta > 0 ? '+' : ''}${best.delta}` : '—'}
              label={best ? `Best round (R${best.round})` : 'Best round'}
              shown={skip || stage >= BEAT_STATS}
              delay="0.16s"
            />
          </div>

          {/* The point of the screen: go again. */}
          <div
            className={`${skip || stage >= BEAT_CTA ? '' : 'opacity-0 '}${skip ? '' : 'azul-res-rise '}order-4 flex w-full max-w-xl flex-col items-center gap-2.5`}
          >
            <button
              type="button"
              onClick={onPlayAgain}
              className={`${skip ? '' : 'azul-res-breathe '}group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-sky-500 to-sky-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-sky-900/40 transition hover:from-sky-400 hover:to-sky-500 active:scale-[0.98] sm:py-4 sm:text-lg`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>{PLAY_AGAIN_LABEL}</span>
              <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
                →
              </span>
            </button>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              {onWatchReplay && (
                <button
                  type="button"
                  onClick={onWatchReplay}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/70 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800 hover:text-white active:scale-[0.98]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>Watch replay</span>
                </button>
              )}
              <Link
                to={`/leaderboard?ai=${aiLevel}`}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/70 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800 hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 stroke-current"
                  fill="none"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M5 20V10M12 20V4M19 20v-6" />
                </svg>
                <span>Leaderboard</span>
              </Link>
            </div>

            <p className="pt-1 text-center text-xs italic text-neutral-500">
              “{verdictLine(tone, Math.abs(margin))}”
            </p>
          </div>

          {/* Where the run stands on today's board. */}
          <div className="order-5 flex min-h-[44px] w-full max-w-2xl items-center justify-center rounded-xl border border-neutral-800/80 bg-neutral-900/60 px-4 py-2.5 text-center text-xs text-neutral-300 shadow-inner backdrop-blur-sm">
            {submissionState?.kind === 'submitting' && (
              <span className="animate-pulse text-sky-300">
                Posting your score to today&apos;s leaderboard…
              </span>
            )}
            {submissionState?.kind === 'posted' && (
              <span className="text-neutral-200">
                🎉 Personal best — <span className="font-bold text-sky-300">Rank {submissionState.rank}</span>{' '}
                of {submissionState.totalEntries} today on{' '}
                <Link
                  to={`/leaderboard?ai=${aiLevel}`}
                  className="font-semibold text-sky-400 underline hover:text-sky-300"
                >
                  {opponentName} Board
                </Link>
              </span>
            )}
            {submissionState?.kind === 'not-improved' && (
              <span className="text-neutral-400">
                Completed! Previous best was higher, so board keeps existing record.
              </span>
            )}
            {submissionState?.kind === 'awaiting-auth' && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span>Sign in to record your score:</span>
                <button
                  type="button"
                  onClick={onOpenSignIn}
                  className="rounded bg-sky-600 px-2.5 py-0.5 font-semibold text-white hover:bg-sky-500"
                >
                  Sign in
                </button>
              </div>
            )}
            {submissionState?.kind === 'failed' && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-rose-300">
                <span>{submissionState.message}</span>
                {onRetrySubmit && (
                  <button
                    type="button"
                    onClick={onRetrySubmit}
                    className="rounded border border-neutral-700 bg-neutral-800 px-2 py-0.5 text-xs text-neutral-200 hover:bg-neutral-700"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
            {!submissionState && (
              <span className="text-neutral-400">
                {ranked ? 'Scores recorded for ranked match' : 'Practice mode — unrecorded match'}
              </span>
            )}
          </div>

          {/* Round-by-round: where the game was actually won or lost. */}
          {rounds && rounds.length > 0 && (
            <div className="order-6 w-full max-w-4xl">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                <span aria-hidden="true">📊</span>
                <span>Match breakdown</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] gap-2">
                {rounds.map((r, i) => (
                  <div
                    key={r.round}
                    className={`${skip || stage >= BEAT_STATS ? '' : 'opacity-0 '}${
                      skip ? '' : 'azul-res-pop '
                    }rounded-xl border border-neutral-800/80 bg-neutral-900/50 px-2 py-2.5 text-center ${
                      r.delta > 0 ? 'ring-1 ring-emerald-500/20' : ''
                    }`}
                    style={{ '--d': `${0.25 + i * 0.07}s` } as React.CSSProperties}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      Round {r.round}
                    </div>
                    <div
                      className={`font-mono text-xl font-black ${
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
                  <div
                    className={`${skip || stage >= BEAT_STATS ? '' : 'opacity-0 '}${
                      skip ? '' : 'azul-res-pop '
                    }rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-2 py-2.5 text-center`}
                    style={{ '--d': `${0.25 + rounds.length * 0.07}s` } as React.CSSProperties}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/80">
                      Bonus
                    </div>
                    <div
                      className={`font-mono text-xl font-black ${
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

              {bonus && <BonusTable bonus={bonus} opponentName={opponentName} />}

              <div className="mt-2 flex items-center justify-between rounded-xl border border-neutral-800/80 bg-neutral-900/40 px-3 py-2 text-xs">
                <span className="font-semibold uppercase tracking-wide text-neutral-500">Final</span>
                <span className="font-mono font-bold">
                  <span className={isWin ? 'text-sky-300' : 'text-neutral-300'}>{humanScore}</span>
                  <span className="px-1.5 text-neutral-600">–</span>
                  <span className={isLose ? 'text-rose-300' : 'text-neutral-400'}>
                    {opponentScore}
                  </span>
                </span>
              </div>
            </div>
          )}

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="order-7 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition hover:text-neutral-300 sm:text-sm"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 stroke-current"
                fill="none"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M19 12H5" />
                <path d="M12 19l-7-7 7-7" />
              </svg>
              <span>{backLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PlayerBadge({
  name,
  score,
  avatar,
  accent,
  align,
  shown,
  delay,
}: {
  name: string;
  score: number;
  avatar: React.ReactNode;
  accent: 'sky' | 'rose' | 'muted' | 'neutral';
  align: string;
  shown: boolean;
  delay: string;
}) {
  const ring =
    accent === 'sky'
      ? 'ring-2 ring-sky-400/70 shadow-lg shadow-sky-500/25 bg-sky-950/50'
      : accent === 'rose'
        ? 'ring-2 ring-rose-400/60 shadow-lg shadow-rose-500/20 bg-rose-950/40'
        : 'ring-1 ring-neutral-700 bg-neutral-900/60';
  const value =
    accent === 'sky' ? 'text-sky-300' : accent === 'rose' ? 'text-rose-300' : 'text-neutral-300';
  return (
    <div
      className={`${shown ? 'azul-res-pop ' : 'opacity-0 '}flex flex-col items-center gap-1.5 ${align}`}
      style={{ '--d': delay } as React.CSSProperties}
    >
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-full p-2 sm:h-20 sm:w-20 md:h-16 md:w-16 lg:h-20 lg:w-20 xl:h-24 xl:w-24 ${ring}`}
      >
        {avatar}
      </div>
      <span className="max-w-[7rem] truncate text-xs font-semibold text-neutral-300 sm:text-sm">
        {name}
      </span>
      <span className={`font-mono text-2xl font-black leading-none sm:text-3xl ${value}`}>{score}</span>
    </div>
  );
}

function StatTile({
  icon,
  iconClass = '',
  value,
  label,
  shown,
  delay,
}: {
  icon: string;
  iconClass?: string;
  value: string;
  label: string;
  shown: boolean;
  delay: string;
}) {
  return (
    <div
      className={`${shown ? 'azul-res-pop ' : 'opacity-0 '}flex flex-col items-center gap-0.5 rounded-xl border border-neutral-800/80 bg-neutral-900/50 px-2 py-2.5 text-center sm:px-4 sm:py-3`}
      style={{ '--d': delay } as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-sm ${iconClass}`} aria-hidden="true">
          {icon}
        </span>
        <span className="text-lg font-black text-neutral-100 sm:text-xl">{value}</span>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wide text-neutral-500 sm:text-xs">
        {label}
      </span>
    </div>
  );
}

