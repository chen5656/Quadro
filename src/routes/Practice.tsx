/**
 * Practice: any level, any seed, nothing recorded (FR-010 … FR-015).
 *
 * Fully playable offline (FR-014); it never touches the network, and a Practice
 * game issues no request at all (AC-006, AC-007).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { QuadroGame } from '../engine';
import { LEVEL_LABELS, type AgentLevel } from '../ai';
import { Board } from '../components/Board';
import { LevelPickerModal } from '../components/LevelPickerModal';
import { Modal } from '../components/Modal';
import { GameResultCard } from '../components/GameResultCard';
import { FocusResultPanel } from '../components/FocusResultPanel';
import { matchBreakdown } from '../game/breakdown';
import { useGameStyle } from '../context/GameStyleContext';
import { useGameSession } from '../game/useGameSession';
import { PRACTICE_LEVELS, practiceHrefFor, resolvePracticeLevel } from '../practice/levels';
import { shareFor } from '../replay/share';
import { storage } from '../storage';
import { useRouter } from '../router';

export const MIN_SEED = 0;
export const MAX_SEED = 2 ** 31 - 1;

export function randomSeed(): number {
  return Math.floor(Math.random() * MAX_SEED);
}

export function isValidSeed(text: string): boolean {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const num = Number(trimmed);
  return Number.isSafeInteger(num) && num >= MIN_SEED && num <= MAX_SEED;
}

interface Setup {
  level: AgentLevel;
  seed: number;
}

function resolvePracticeSeed(search: string): number {
  const params = new URLSearchParams(
    search || (typeof window !== 'undefined' ? window.location.search : ''),
  );
  const seedParam = params.get('seed');
  if (seedParam !== null && isValidSeed(seedParam)) {
    return Number(seedParam);
  }
  const remembered = storage.practiceSeed();
  if (remembered !== null && isValidSeed(remembered)) {
    return Number(remembered);
  }
  return randomSeed();
}

export function Practice() {
  const { search, navigate } = useRouter();
  const level = resolvePracticeLevel(search);
  const [seed, setSeed] = useState<number>(() => resolvePracticeSeed(search));

  // Sync state if seed param in URL changes to a valid different seed
  useEffect(() => {
    const params = new URLSearchParams(search);
    const paramSeed = params.get('seed');
    if (paramSeed !== null && isValidSeed(paramSeed)) {
      const parsed = Number(paramSeed);
      if (parsed !== seed) {
        setSeed(parsed);
      }
    }
  }, [search, seed]);

  // Ensure the URL always explicitly includes ?level=...&seed=... and no legacy ?ai=
  useEffect(() => {
    const params = new URLSearchParams(search);
    const currentLevelParam = params.get('level');
    const currentSeedParam = params.get('seed');
    const hasAi = params.has('ai');
    const hasPlay = params.has('play');

    if (
      currentLevelParam !== level ||
      currentSeedParam !== String(seed) ||
      hasAi ||
      hasPlay
    ) {
      params.delete('ai');
      params.delete('play');
      params.set('level', level);
      params.set('seed', String(seed));
      navigate(`/practice?${params.toString()}`, { replace: true });
    }
  }, [search, level, seed, navigate]);

  // Remember the level & seed in storage
  useEffect(() => {
    storage.setPracticeLevel(level);
  }, [level]);

  useEffect(() => {
    storage.setPracticeSeed(String(seed));
  }, [seed]);

  const handleNewDeal = useCallback((nextSeed: number) => {
    setSeed(nextSeed);
  }, []);

  const setup: Setup = useMemo(() => ({ level, seed }), [level, seed]);

  return (
    <PracticeGame
      key={`${setup.seed}:${setup.level}`}
      setup={setup}
      onNewDeal={handleNewDeal}
    />
  );
}

function PracticeGame({
  setup,
  onNewDeal,
}: {
  setup: Setup;
  onNewDeal: (seed: number) => void;
}) {
  const deal = setup.seed;
  const newGame = useCallback(() => new QuadroGame(deal), [deal]);
  // Seedless on purpose: the deal is reproducible from its seed, the opponent
  // is not. Restarting the same deal gets a new game, not a rerun of the old.
  const ai = useMemo(() => ({ level: setup.level }), [setup.level]);
  const session = useGameSession({ newGame, ai, timed: false });
  const { style } = useGameStyle();
  const [showSettings, setShowSettings] = useState(false);
  const [showSeedModal, setShowSeedModal] = useState(false);
  const opponentLabel = LEVEL_LABELS[setup.level];

  /** A fresh random deal. */
  const rollRandomDeal = useCallback(() => {
    const next = randomSeed();
    onNewDeal(next);
  }, [onNewDeal]);

  const topRight = (
    <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={session.restart}
        className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs sm:text-sm hover:bg-neutral-800 transition"
      >
        Restart
      </button>
      <button
        type="button"
        onClick={rollRandomDeal}
        className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs sm:text-sm hover:bg-neutral-800 transition"
      >
        Random deal
      </button>
      <button
        type="button"
        onClick={() => setShowSeedModal(true)}
        className="rounded-lg border border-neutral-700 px-2.5 py-1 text-xs sm:text-sm hover:bg-neutral-800 transition"
      >
        Deal seed
      </button>
    </div>
  );

  const { search, navigate } = useRouter();
  const result = session.status === 'game-over' ? session.game.result() : null;

  /** The link and recap for the game just finished; null while one is running. */
  const share = useMemo(
    () =>
      session.status === 'game-over'
        ? shareFor(
            session.game,
            { aiLevel: setup.level, humanSeat: session.humanSeat, puzzleId: null },
            { levelLabel: LEVEL_LABELS[setup.level] ?? setup.level, elapsedMs: session.elapsedMs },
          )
        : null,
    // The game object is mutated in place, so the status edge is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.status, setup.level, session.humanSeat],
  );

  return (
    <div className="flex flex-col gap-3 sm:gap-4 w-full">
      {result && style === 'focus' && (
        <FocusResultPanel
          humanWon={session.humanWon}
          draw={result.draw}
          elapsedMs={session.elapsedMs}
          aiLevel={setup.level}
          humanScore={result.scores[session.humanSeat]}
          opponentScore={result.scores[1 - session.humanSeat]}
          breakdown={matchBreakdown(session.game.events, session.humanSeat)}
          onNewGame={rollRandomDeal}
          onRestart={session.restart}
          onBack={() => setShowSeedModal(true)}
          backLabel="Deal seed"
        />
      )}

      {result && style !== 'focus' && (
        <GameResultCard
          humanWon={session.humanWon}
          draw={result.draw}
          elapsedMs={session.elapsedMs}
          aiLevel={setup.level}
          humanScore={result.scores[session.humanSeat]}
          opponentScore={result.scores[1 - session.humanSeat]}
          breakdown={matchBreakdown(session.game.events, session.humanSeat)}
          ranked={false}
          onPlayAgain={rollRandomDeal}
          onRestart={session.restart}
          onBack={() => setShowSeedModal(true)}
          backLabel="Deal seed"
          share={share}
          onWatchReplay={share ? () => window.open(share.url, '_blank') : undefined}
          onSwitchToRanked={() => navigate('/daily?level=expert')}
        />
      )}

      {!result && (
        <Board
          session={session}
          humanLabel="You"
          opponentLabel={opponentLabel}
          topRight={topRight}
          onChangeLevel={() => setShowSettings(true)}
          title="Practice"
        />
      )}

      <LevelPickerModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        levels={PRACTICE_LEVELS}
        selected={setup.level}
        onSelect={(next) => {
          setShowSettings(false);
          navigate(practiceHrefFor(next, search));
        }}
        description="Pick the opponent. Practice games are never timed or recorded to history."
      />

      <PracticeSeedModal
        isOpen={showSeedModal}
        onClose={() => setShowSeedModal(false)}
        currentSeed={deal}
        level={setup.level}
        onApplySeed={(newSeed) => {
          setShowSeedModal(false);
          onNewDeal(newSeed);
        }}
      />
    </div>
  );
}

function PracticeSeedModal({
  isOpen,
  onClose,
  currentSeed,
  level,
  onApplySeed,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentSeed: number;
  level: AgentLevel;
  onApplySeed: (seed: number) => void;
}) {
  const [seedText, setSeedText] = useState(String(currentSeed));

  // Reset input value to currentSeed when modal opens
  useEffect(() => {
    if (isOpen) {
      setSeedText(String(currentSeed));
    }
  }, [isOpen, currentSeed]);

  const seedValid = isValidSeed(seedText);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedValid) return;
    onApplySeed(Number(seedText.trim()));
  };

  const handleRandomize = () => {
    setSeedText(String(randomSeed()));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Deal Seed">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between text-sm rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-2">
          <span className="text-neutral-400">Opponent level:</span>
          <span className="font-medium text-sky-400">{LEVEL_LABELS[level]}</span>
        </div>

        <div>
          <label htmlFor="modal-seed-input" className="block text-xs font-medium text-neutral-300">
            Seed number (0 – {MAX_SEED})
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="modal-seed-input"
              type="text"
              inputMode="numeric"
              value={seedText}
              onChange={(e) => setSeedText(e.target.value)}
              aria-invalid={!seedValid}
              aria-describedby="modal-seed-help"
              className={`w-full rounded-md border bg-neutral-950 px-3 py-2 text-sm font-mono ${
                seedValid ? 'border-neutral-700' : 'border-red-500'
              }`}
            />
            <button
              type="button"
              onClick={handleRandomize}
              className="shrink-0 rounded-md border border-neutral-700 px-3 py-2 text-xs font-medium hover:bg-neutral-800 transition text-neutral-300"
            >
              Randomize
            </button>
          </div>
          <p id="modal-seed-help" className="mt-1.5 text-xs text-neutral-500">
            {seedValid
              ? `Current deal seed: ${currentSeed}. Change to replay or test a specific deal.`
              : `Please enter a valid whole number between 0 and ${MAX_SEED}.`}
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-800 transition text-neutral-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!seedValid}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium hover:bg-sky-500 transition disabled:opacity-50 text-white"
          >
            Play deal
          </button>
        </div>
      </form>
    </Modal>
  );
}
