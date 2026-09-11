/**
 * `/history` — every Daily the signed-in player has posted.
 *
 * `scores` already keeps one row per (day, opponent), so this is a read of
 * rows that always existed rather than a new kind of record. Rows posted by a
 * client that sends its replay get a Watch link; older rows simply do not.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { LEVEL_LABELS, type AgentLevel } from '../ai';
import { ApiError, type HistoryEntry, getHistory } from '../api/client';
import { RobotAvatar } from '../components/RobotAvatar';
import { TrophyIcon } from '../components/TrophyIcon';
import { useIdentity } from '../auth';
import { useGameStyle } from '../context/GameStyleContext';
import { decodeReplay } from '../replay/codec';
import { ENGINE_VERSION } from '../replay/version';
import { ShareButton } from '../components/ShareButton';
import { formatDuration, recapText, replayHref } from '../replay/share';
import { Link } from '../router';

type Load = 'loading' | 'ready' | 'signed-out' | 'error';

/** Compare two history entries to find which is a better performance */
function isBetterEntry(a: HistoryEntry, b: HistoryEntry): boolean {
  const levelOrder: Record<string, number> = {
    extreme: 6,
    master: 5,
    expert: 4,
    hard: 3,
    medium: 2,
    easy: 1,
  };
  const orderA = levelOrder[a.ai_level] ?? 0;
  const orderB = levelOrder[b.ai_level] ?? 0;
  if (orderA !== orderB) return orderA > orderB;

  // Same level: compare margin
  if (a.margin !== b.margin) return a.margin > b.margin;

  // Same margin: faster time wins
  if (a.elapsed_ms !== b.elapsed_ms) return a.elapsed_ms < b.elapsed_ms;

  // Earlier completion wins
  return a.played_at < b.played_at;
}

export function HistoryPage() {
  const identity = useIdentity();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<Load>('loading');
  const [message, setMessage] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (before: string | null, append: boolean) => {
      if (!identity.signedIn) {
        setState(identity.ready ? 'signed-out' : 'loading');
        return;
      }
      try {
        const page = await getHistory({ before });
        setEntries((prev) => (append ? [...prev, ...page.entries] : page.entries));
        setCursor(page.next_before);
        setState('ready');
      } catch (err) {
        setMessage(err instanceof ApiError ? err.message : 'Could not load your history.');
        setState('error');
      }
    },
    [identity.signedIn, identity.ready],
  );

  useEffect(() => {
    void fetchPage(null, false);
  }, [fetchPage]);

  // Determine the single best entry for each puzzle_id (day)
  const bestEntryByDay = useMemo(() => {
    const map = new Map<string, HistoryEntry>();
    for (const entry of entries) {
      const existing = map.get(entry.puzzle_id);
      if (!existing || isBetterEntry(entry, existing)) {
        map.set(entry.puzzle_id, entry);
      }
    }
    return map;
  }, [entries]);

  if (state === 'signed-out') {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <h1 className="mb-2 text-xl font-semibold">Your history</h1>
        <p className="mb-4 text-sm text-neutral-400">
          Sign in to see the Dailies you have played — and to rewatch them.
        </p>
        <button
          type="button"
          onClick={identity.openSignIn}
          className="inline-block rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Your history</h1>
      <p className="mb-4 text-sm text-neutral-500">
        All your completed Daily attempts. Your highest score each day is awarded the daily trophy.
      </p>

      {state === 'loading' && <p className="text-sm text-neutral-400">Loading…</p>}

      {state === 'error' && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/40 p-3">
          <p role="alert" className="text-sm text-rose-200">
            {message}
          </p>
          <button
            type="button"
            onClick={() => void fetchPage(null, false)}
            className="mt-2 cursor-pointer rounded border border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-800"
          >
            Try again
          </button>
        </div>
      )}

      {state === 'ready' && entries.length === 0 && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-6 text-center">
          <p className="mb-3 text-sm text-neutral-300">You have not posted a Daily yet.</p>
          <Link
            to="/daily"
            className="inline-block rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Play today’s puzzle
          </Link>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.map((entry, idx) => {
            const isDailyBest = bestEntryByDay.get(entry.puzzle_id) === entry;
            return (
              <HistoryRow
                key={`${entry.puzzle_id}:${entry.ai_level}:${entry.played_at || idx}`}
                entry={entry}
                isDailyBest={isDailyBest}
              />
            );
          })}
        </ul>
      )}

      {cursor && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            await fetchPage(cursor, true);
            setLoadingMore(false);
          }}
          className="mt-3 w-full cursor-pointer rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}

function HistoryRow({ entry, isDailyBest }: { entry: HistoryEntry; isDailyBest: boolean }) {
  const { style } = useGameStyle();
  const level = entry.ai_level as AgentLevel;
  const label = LEVEL_LABELS[level] ?? entry.ai_level;
  const won = entry.margin > 0;

  /**
   * Decoded rather than rebuilt from the row's own numbers, so the recap a
   * player pastes is produced by the same function as everywhere else and
   * cannot drift from it.
   */
  const share = useMemo(() => {
    if (!entry.replay) return null;
    try {
      const replay = decodeReplay(entry.replay, ENGINE_VERSION);
      return {
        url: `${window.location.origin}${replayHref(entry.replay)}`,
        text: recapText(replay, {
          levelLabel: label,
          elapsedMs: entry.elapsed_ms,
          rank: entry.rank,
        }),
      };
    } catch {
      return null;
    }
  }, [entry.replay, entry.elapsed_ms, entry.rank, label]);

  return (
    <li
      className={`relative flex flex-wrap items-center gap-3 rounded-lg border p-3 transition-colors ${
        isDailyBest
          ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/20 via-neutral-900/80 to-neutral-900/60 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
          : 'border-neutral-800 bg-neutral-900/60'
      }`}
    >
      {style !== 'focus' && <RobotAvatar level={level} className="h-8 w-8 shrink-0" />}

      <div className="min-w-[7rem] flex-1">
        <span className="font-medium tabular-nums text-neutral-100">
          {entry.puzzle_id}
        </span>
        <p className="text-xs text-neutral-400">vs {label}</p>
      </div>

      {/* Middle: 3D trophy for daily best score */}
      <div className="flex shrink-0 items-center justify-center sm:px-2">
        {isDailyBest ? (
          <div
            className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 shadow-sm"
            title="Your best score on this day"
          >
            <TrophyIcon size={20} />
            <span className="tracking-wide">Best Score</span>
          </div>
        ) : (
          <div className="w-0 sm:w-16" />
        )}
      </div>

      <div className="text-right">
        <p className="tabular-nums">
          <span className={won ? 'font-semibold text-emerald-400' : 'text-neutral-300'}>
            {entry.final_score}–{entry.opponent_score}
          </span>{' '}
          <span className="text-xs text-neutral-500">
            ({entry.margin >= 0 ? '+' : ''}
            {entry.margin})
          </span>
        </p>
        <p className="text-xs tabular-nums text-neutral-500">
          {formatDuration(entry.elapsed_ms)}
          {entry.attempts && entry.attempts > 1 && ` · #${entry.attempts}`}
        </p>
      </div>

      {entry.replay ? (
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={replayHref(entry.replay)}
            className="cursor-pointer rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
          >
            Watch
          </Link>
          {share && <ShareButton url={share.url} text={share.text} />}
        </div>
      ) : (
        <span
          className="text-xs text-neutral-600"
          title="This game was posted before replays were recorded."
        >
          No replay
        </span>
      )}
    </li>
  );
}
