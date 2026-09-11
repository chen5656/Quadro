/**
 * `/r/<code>` — watching a recorded game.
 *
 * The whole game lives in the URL, so this page needs no account, no network
 * call and no database row: it decodes the code, rebuilds the position with
 * the engine, and hands the result to the *real* `Board`. What a viewer
 * watches is drawn by the same components that drew it when it was played.
 *
 * This is the page most links point at, so it is also where a stranger meets
 * the game: the header's call to action sends them at the same deal.
 */

import { useMemo, useState, type ReactNode } from 'react';

import { LEVEL_LABELS, type AgentLevel } from '../ai';
import { Board } from '../components/Board';
import { BonusTable } from '../components/BonusTable';
import { RobotAvatar, levelChip } from '../components/RobotAvatar';
import { matchBreakdown, type MatchBreakdown } from '../game/breakdown';
import { useGameStyle } from '../context/GameStyleContext';
import { useReplaySession } from '../game/useReplaySession';
import { ReplayDecodeError, decodeReplay, type Replay } from '../replay/codec';
import { runReplay } from '../replay/rebuild';
import { ShareButton } from '../components/ShareButton';
import { puzzleIdFor, seedForPuzzle } from '../daily/puzzle';
import { formatDuration, recapText, replayHref } from '../replay/share';
import { ENGINE_VERSION } from '../replay/version';
import { Link, useRouter } from '../router';

export function ReplayPage() {
  const { params } = useRouter();
  const code = params.code ?? '';

  const decoded = useMemo((): { replay: Replay } | { error: string; hint: string } => {
    if (!code) {
      return {
        error: 'No replay in this link.',
        hint: 'A replay link looks like /r/… — check that the whole link was copied.',
      };
    }
    try {
      return { replay: decodeReplay(code, ENGINE_VERSION) };
    } catch (err) {
      if (err instanceof ReplayDecodeError) {
        return {
          error:
            err.code === 'ENGINE_MISMATCH'
              ? 'This replay is from an older version of the game.'
              : 'This replay link is damaged.',
          hint:
            err.code === 'ENGINE_MISMATCH'
              ? 'The rules changed since it was recorded, so playing it back would show a game that never happened.'
              : err.message,
        };
      }
      throw err;
    }
  }, [code]);

  if ('error' in decoded) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <h1 className="mb-2 text-xl font-semibold">{decoded.error}</h1>
        <p className="mb-6 text-sm text-neutral-400">{decoded.hint}</p>
        <Link to="/daily" className="text-sky-400 underline hover:text-sky-300">
          Play today’s puzzle instead
        </Link>
      </div>
    );
  }

  // Keyed on the code so a different replay rebuilds from scratch rather than
  // feeding new actions to a half-played game.
  return <ReplayView key={code} replay={decoded.replay} code={code} />;
}

function ReplayView({ replay, code }: { replay: Replay; code: string }) {
  /**
   * A shared link opens on the result, not on a running board.
   *
   * The link is a boast: the first thing its recipient came for is the score
   * and who it was against, and a board that starts moving under a stranger
   * who has not been told what they are watching answers a question they had
   * not asked yet. Playback is one press away, and that press is the point at
   * which they have decided to watch.
   */
  const [watching, setWatching] = useState(false);
  const controls = useReplaySession(replay, { autoplay: watching });
  const { style } = useGameStyle();
  const level = replay.aiLevel as AgentLevel;
  const opponentLabel = LEVEL_LABELS[level] ?? replay.aiLevel;

  /**
   * The scores are re-derived from the moves rather than read off the link.
   *
   * A replay code carries a claimed score as well as the actions, and nothing
   * stops someone hand-editing the claim. Running the game is how the Worker
   * checks a posted score (`worker/replay.ts`); doing the same here means the
   * headline on this page is the score the moves actually produce, and the
   * round-by-round strip underneath is guaranteed to add up to it.
   */
  const verified = useMemo(() => {
    try {
      const game = runReplay(replay);
      const result = game.result();
      return {
        scores: result.scores,
        breakdown: matchBreakdown(game.events, replay.humanSeat),
      };
    } catch {
      // A code whose moves do not run is still worth opening: playback reports
      // what went wrong. The card just falls back to what the link claims.
      return null;
    }
  }, [replay]);

  const scores = verified?.scores ?? replay.scores;
  const mine = scores[replay.humanSeat];
  const theirs = scores[1 - replay.humanSeat];
  const margin = mine - theirs;

  /**
   * Where the invitation sends a viewer.
   *
   * Today's deal is still live, so it goes to the Daily where their result can
   * actually land on the board next to this one. Any older deal cannot: the
   * Worker refuses a score for a puzzle that is no longer current
   * (`worker/scores.ts`), so pointing there would promise a rematch that
   * silently never posts. Those go to Practice on the same seed instead, and
   * the line under the button says so rather than letting them find out after
   * twenty minutes of play.
   */
  const challenge = useMemo(() => {
    const today = puzzleIdFor();
    if (replay.puzzleId === today) {
      return { href: `/daily?level=${replay.aiLevel}`, note: null as string | null };
    }
    if (replay.puzzleId) {
      return {
        href: `/practice?seed=${seedForPuzzle(replay.puzzleId)}&level=${replay.aiLevel}&play=1`,
        note: `That deal is from ${replay.puzzleId}, so it opens in Practice — past days are no longer ranked.`,
      };
    }
    return {
      href: `/practice?seed=${replay.seed}&level=${replay.aiLevel}&play=1`,
      note: 'Practice games are never ranked, but this is the same deal.',
    };
  }, [replay.puzzleId, replay.aiLevel, replay.seed]);

  const currentRound =
    controls.roundAt[Math.min(controls.cursor, controls.roundAt.length - 1)] ?? 1;

  const share = (
    <ShareButton
      url={`${window.location.origin}${replayHref(code)}`}
      text={recapText(replay, { levelLabel: opponentLabel })}
      label="Share"
      title="Share this replay"
    />
  );

  return (
    <div className="flex w-full flex-col gap-3 sm:gap-4">
      <ScoreCard
        replay={replay}
        level={level}
        opponentLabel={opponentLabel}
        mine={mine}
        theirs={theirs}
        margin={margin}
        breakdown={verified?.breakdown ?? null}
        compact={watching}
        showBadge={style !== 'focus'}
        onWatch={() => setWatching(true)}
        challenge={challenge}
        share={share}
      />

      {controls.error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200"
        >
          {controls.error}
        </p>
      )}

      {watching && (
        <>
          <ReplayControlsBar controls={controls} round={currentRound} />

          <Board
            session={controls.session}
            humanLabel="Player"
            opponentLabel={opponentLabel}
            title={`Replay (${replay.puzzleId ?? 'Practice'})`}
          />

          <CopyRecap replay={replay} levelLabel={opponentLabel} />
        </>
      )}
    </div>
  );
}

/**
 * The headline: who was beaten, by how much, and how the points got there.
 *
 * Once playback starts the same card shrinks to a single line rather than
 * disappearing — the board below it is mid-game for most of the replay, and
 * without the final score on screen there is nothing to say what it is
 * heading towards.
 */
function ScoreCard({
  replay,
  level,
  opponentLabel,
  mine,
  theirs,
  margin,
  breakdown,
  compact,
  showBadge,
  onWatch,
  challenge,
  share,
}: {
  replay: Replay;
  level: AgentLevel;
  opponentLabel: string;
  mine: number;
  theirs: number;
  margin: number;
  breakdown: MatchBreakdown | null;
  compact: boolean;
  showBadge: boolean;
  onWatch: () => void;
  challenge: { href: string; note: string | null };
  share: ReactNode;
}) {
  const won = margin > 0;
  const drew = margin === 0;
  const verdict = drew ? 'Drew with' : won ? 'Beat' : 'Lost to';
  const deal = replay.puzzleId ? `Daily · ${replay.puzzleId}` : 'Practice deal';

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
        {showBadge && <RobotAvatar level={level} className="h-7 w-7" />}
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold leading-tight">
            {verdict} {opponentLabel} {mine}–{theirs}
          </h1>
          <p className="text-xs text-neutral-500">{deal}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">{share}</div>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/60">
      <div className="flex flex-col items-center gap-4 px-4 py-6 sm:px-8 sm:py-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">{deal}</p>

        {/* The opponent, at the size the boast deserves: the difficulty is
            half of what the score means. */}
        <div
          className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 text-sm font-bold uppercase tracking-wide ${levelChip(level)}`}
        >
          {showBadge && <RobotAvatar level={level} className="h-7 w-7" />}
          {opponentLabel}
        </div>

        <h1 className="sr-only">
          {verdict} {opponentLabel} {mine}–{theirs} on {deal}
        </h1>

        <div className="flex items-end justify-center gap-3 font-mono sm:gap-5">
          <span
            className={`text-5xl font-black leading-none sm:text-7xl ${won ? 'text-sky-300' : 'text-neutral-200'}`}
          >
            {mine}
          </span>
          <span className="pb-1 text-2xl font-bold text-neutral-600 sm:pb-2 sm:text-4xl">–</span>
          <span
            className={`text-5xl font-black leading-none sm:text-7xl ${margin < 0 ? 'text-rose-300' : 'text-neutral-400'}`}
          >
            {theirs}
          </span>
        </div>

        <p className="text-sm text-neutral-400">
          <span
            className={`font-semibold ${won ? 'text-sky-300' : drew ? 'text-neutral-300' : 'text-rose-300'}`}
          >
            {verdict} {opponentLabel}
          </span>{' '}
          by{' '}
          <span className="font-mono font-semibold text-neutral-200">
            {margin > 0 ? '+' : ''}
            {margin}
          </span>
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={onWatch}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
              <path d="m5 3 8 5-8 5z" />
            </svg>
            Watch the replay
          </button>
          <Link
            to={challenge.href}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-neutral-200 transition hover:bg-neutral-800 hover:text-white"
          >
            Beat my score
          </Link>
          {share}
        </div>

        {challenge.note && (
          <p className="max-w-md text-center text-xs text-neutral-500">{challenge.note}</p>
        )}
      </div>

      {breakdown && breakdown.rounds.length > 0 && (
        <ScoreComposition breakdown={breakdown} opponentLabel={opponentLabel} />
      )}
    </section>
  );
}

/**
 * Where the points came from: the swing each round was worth, then the
 * end-game bonuses that the rounds alone never account for.
 */
function ScoreComposition({
  breakdown,
  opponentLabel,
}: {
  breakdown: MatchBreakdown;
  opponentLabel: string;
}) {
  const { rounds, bonus } = breakdown;

  return (
    <div className="border-t border-neutral-800 bg-neutral-950/40 px-4 py-4 sm:px-8">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        How the score was built
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(78px,1fr))] gap-2">
        {rounds.map((r) => (
          <div
            key={r.round}
            className={`rounded-xl border border-neutral-800/80 bg-neutral-900/50 px-2 py-2.5 text-center ${
              r.delta > 0 ? 'ring-1 ring-emerald-500/20' : ''
            }`}
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
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-2 py-2.5 text-center">
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

      {bonus && <BonusTable bonus={bonus} opponentName={opponentLabel} />}
    </div>
  );
}

function ReplayControlsBar({
  controls,
  round,
}: {
  controls: ReturnType<typeof useReplaySession>;
  round: number;
}) {
  const { cursor, total, playing, error } = controls;
  const atEnd = cursor >= total;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
      <button
        type="button"
        disabled={!!error || atEnd}
        onClick={() => (playing ? controls.pause() : controls.play())}
        className="min-w-[5rem] cursor-pointer rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {playing ? 'Pause' : atEnd ? 'Finished' : 'Play'}
      </button>
      <button
        type="button"
        disabled={!!error || atEnd}
        onClick={controls.stepForward}
        className="cursor-pointer rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Step
      </button>
      <button
        type="button"
        onClick={controls.restart}
        className="cursor-pointer rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-neutral-700"
      >
        Restart
      </button>

      <label className="flex items-center gap-1.5 text-xs text-neutral-400">
        Speed
        <select
          value={controls.speed}
          onChange={(event) => controls.setSpeed(Number(event.target.value))}
          className="cursor-pointer rounded-md border border-neutral-700 bg-neutral-800 px-1.5 py-1 text-xs text-neutral-200"
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </label>

      {/* Seeking rebuilds from the opening deal rather than stepping backwards:
          the engine has no reverse, and a rebuild is microseconds. */}
      <input
        type="range"
        min={0}
        max={total}
        value={Math.min(cursor, total)}
        onChange={(event) => controls.seek(Number(event.target.value))}
        aria-label="Move"
        className="h-1.5 min-w-[8rem] flex-1 cursor-pointer accent-sky-500"
      />
      <span className="tabular-nums text-xs text-neutral-400">
        Round {round} · move {Math.min(cursor, total)} / {total}
      </span>
    </div>
  );
}

function CopyRecap({ replay, levelLabel }: { replay: Replay; levelLabel: string }) {
  const text = recapText(replay, { levelLabel });
  return (
    <p className="text-xs text-neutral-500">
      {text.split('\n')[0]} — watching move-by-move, both sides. Scores shown update as the
      round settles, exactly as they did in the game.
    </p>
  );
}

export { formatDuration };
