import { Modal } from './Modal';

export function SlowAiWarning({ open, onWait, onChangeLevel }: {
  open: boolean;
  onWait: () => void;
  onChangeLevel?: () => void;
}) {
  return (
    <Modal isOpen={open} onClose={onWait} title="Extreme is taking longer">
      <p className="text-sm text-neutral-300">
        Extreme has taken 10 seconds to think on this device. Future turns may also
        take longer. You can keep waiting or choose a faster AI for a new game.
      </p>
      <p className="mt-3 text-sm text-neutral-400">
        Thinking continues while this message is open. Extreme completes the same
        full search on every device. If its worker stops making progress, the game
        shows an error instead of playing a weaker move.
      </p>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {onChangeLevel && (
          <button type="button" className="rounded-lg border border-neutral-700 px-3 py-2 text-sm"
            onClick={() => { onWait(); onChangeLevel(); }}>
            Choose another AI
          </button>
        )}
        <button type="button" className="rounded-lg bg-sky-600 px-3 py-2 text-sm text-white"
          onClick={onWait}>
          Keep waiting
        </button>
      </div>
    </Modal>
  );
}
