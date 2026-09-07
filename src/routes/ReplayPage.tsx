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

import { useMemo } from 'react';

import { LEVEL_LABELS, type AgentLevel } from '../ai';
import { Board } from '../components/Board';
import { RobotAvatar } from '../components/RobotAvatar';
import { useGameStyle } from '../context/GameStyleContext';
import { useReplaySession } from '../game/useReplaySession';
import { ReplayDecodeError, decodeReplay, type Replay } from '../replay/codec';
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
  const controls = useReplaySession(replay);
  const { style } = useGameStyle();
  const level = replay.aiLevel as AgentLevel;
  const opponentLabel = LEVEL_LABELS[level];

  const mine = replay.scores[replay.humanSeat];
  const theirs = replay.scores[1 - replay.humanSeat];

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
      return {
        href: `/daily?ai=${replay.aiLevel}`,
        label: 'See if you can beat me',
        note: null as string | null,
      };
    }
    if (replay.puzzleId) {
      return {
        href: `/practice?seed=${seedForPuzzle(replay.puzzleId)}&ai=${replay.aiLevel}`,
        label: 'See if you can beat me',
        note: `That deal is from ${replay.puzzleId}, so it opens in Practice — past days are no longer ranked.`,
      };
    }
    return {
      href: `/practice?seed=${replay.seed}&ai=${replay.aiLevel}`,
      label: 'See if you can beat me',
      note: 'Practice games are never ranked, but this is the same deal.',
    };
  }, [replay.puzzleId, replay.aiLevel, replay.seed]);

  const currentRound =
    controls.roundAt[Math.min(controls.cursor, controls.roundAt.length - 1)] ?? 1;

  return (
    <div className="flex w-full flex-col gap-3 sm:gap-4">
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {style !== 'focus' && <RobotAvatar level={level} className="h-7 w-7" />}
            <div>
              <h1 className="text-base font-semibold leading-tight">
                Replay · {replay.puzzleId ?? 'Practice game'}
              </h1>
              <p className="text-xs text-neutral-400">
                vs {opponentLabel} · finished {mine}–{theirs}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton
              url={`${window.location.origin}${replayHref(code)}`}
              text={recapText(replay, { levelLabel: opponentLabel })}
              label="Share"
              title="Share this replay"
            />
            <Link
              to={challenge.href}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
            >
              {challenge.label}
            </Link>
          </div>
        </div>
      </div>

      {controls.error && (
        <p
          role="alert"
          className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200"
        >
          {controls.error}
        </p>
      )}

      <ReplayControlsBar controls={controls} round={currentRound} />

      <Board
        session={controls.session}
        humanLabel="Player"
        opponentLabel={opponentLabel}
        title={`Replay (${replay.puzzleId ?? 'Practice'})`}
      />

      {challenge.note && <p className="text-xs text-neutral-500">{challenge.note}</p>}

      <CopyRecap replay={replay} levelLabel={opponentLabel} />
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
