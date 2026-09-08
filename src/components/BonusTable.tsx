/**
 * The end-game bonuses, itemised.
 *
 * Shared by the card a player sees when their own game ends and the card a
 * stranger sees on a shared replay — the same numbers, presented the same way,
 * because they are the same claim about the same game.
 */

import { BONUS_VALUES, type BonusSummary } from '../game/breakdown';

/**
 * The end-of-game bonuses, itemised.
 *
 * Without this the strip of rounds does not add up to the score on the card —
 * the last twenty-odd points arrive from completed rows, columns and colours,
 * and a player who counted along is left thinking the screen is wrong.
 */
export function BonusTable({ bonus, opponentName }: { bonus: BonusSummary; opponentName: string }) {
  const lines = [
    { key: 'rows' as const, label: 'Rows', per: BONUS_VALUES.rows },
    { key: 'columns' as const, label: 'Columns', per: BONUS_VALUES.columns },
    { key: 'colors' as const, label: 'Colors', per: BONUS_VALUES.colors },
  ];
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-neutral-800/80 bg-neutral-900/40">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-b border-neutral-800/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 sm:gap-x-6">
        <span>End-game bonus</span>
        <span className="w-16 text-right sm:w-24">You</span>
        <span className="w-16 truncate text-right sm:w-24">{opponentName}</span>
      </div>
      {lines.map(({ key, label, per }) => (
        <div
          key={key}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-1.5 text-xs text-neutral-300 sm:gap-x-6"
        >
          <span className="text-neutral-400">
            {label} <span className="text-neutral-600">×{per}</span>
          </span>
          <BonusCell count={bonus.you[key]} per={per} />
          <BonusCell count={bonus.opponent[key]} per={per} />
        </div>
      ))}
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t border-neutral-800/80 px-3 py-1.5 text-xs font-bold sm:gap-x-6">
        <span className="uppercase tracking-wide text-neutral-500">Bonus total</span>
        <span className="w-16 text-right font-mono text-amber-300 sm:w-24">
          +{bonus.you.points}
        </span>
        <span className="w-16 text-right font-mono text-amber-300/80 sm:w-24">
          +{bonus.opponent.points}
        </span>
      </div>
    </div>
  );
}

function BonusCell({ count, per }: { count: number; per: number }) {
  return (
    <span
      className={`w-16 text-right font-mono sm:w-24 ${count > 0 ? 'text-neutral-200' : 'text-neutral-600'}`}
    >
      {count}
      <span className={count > 0 ? 'text-amber-400/80' : 'text-neutral-700'}>
        {' '}
        (+{count * per})
      </span>
    </span>
  );
}
