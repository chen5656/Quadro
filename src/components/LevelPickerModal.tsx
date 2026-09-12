/**
 * The opponent picker both game routes open from the board's difficulty chip.
 *
 * Daily and Practice differ only in which levels they offer and whether a level
 * is ranked, so the modal takes those as props rather than being duplicated.
 */

import { LEVEL_LABELS, type AgentLevel } from '../ai/base';
import { useGameStyle } from '../context/GameStyleContext';
import { Modal } from './Modal';
import { RobotAvatar } from './RobotAvatar';

export function LevelPickerModal({
  isOpen,
  onClose,
  levels,
  selected,
  onSelect,
  description,
  rankedOf,
}: {
  isOpen: boolean;
  onClose: () => void;
  levels: readonly AgentLevel[];
  selected: AgentLevel;
  onSelect: (level: AgentLevel) => void;
  description: string;
  /** Omitted where ranking does not apply (Practice), which hides the sub-label. */
  rankedOf?: (level: AgentLevel) => boolean;
}) {
  const { style } = useGameStyle();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Difficulty Settings" maxWidth="max-w-md">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-neutral-400">{description}</p>
        <div className="grid grid-cols-1 gap-2 pt-1">
          {levels.map((candidate) => {
            const isSelected = selected === candidate;
            const ranked = rankedOf?.(candidate);
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => {
                  onSelect(candidate);
                  onClose();
                }}
                className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-sky-500 bg-sky-950/50 ring-1 ring-sky-500/50'
                    : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 hover:bg-neutral-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  {style !== 'focus' && <RobotAvatar level={candidate} className="h-10 w-10" />}
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`text-sm font-semibold ${
                        isSelected ? 'text-sky-300' : 'text-neutral-200'
                      }`}
                    >
                      {LEVEL_LABELS[candidate]}
                    </span>
                    {ranked !== undefined && (
                      <span
                        className={`text-[11px] font-medium ${
                          ranked ? 'text-amber-300' : 'text-neutral-500'
                        }`}
                      >
                        {ranked ? 'Ranked · saved to history' : 'Not ranked'}
                      </span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-neutral-950">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 stroke-current"
                      fill="none"
                      strokeWidth="3"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
