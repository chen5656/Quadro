import { useLayoutEffect, useRef, useState } from 'react';
import type { Spotlight, Step } from '../tutorial/script';
import type { Phase } from '../tutorial/useTutorial';
import { Link } from '../router';

interface TutorialPopoverProps {
  step: Step;
  stepIndex: number;
  stepCount: number;
  phase: Phase;
  body: string[];
  canAdvance: boolean;
  next: () => void;
  restart: () => void;
  done: boolean;
  spotlight?: Spotlight;
}

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export function TutorialPopover({
  step,
  stepIndex,
  stepCount,
  phase,
  body,
  canAdvance,
  next,
  restart,
  done,
  spotlight,
}: TutorialPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number; placement: Placement } | null>(null);

  // Compute position relative to spotlighted DOM element
  useLayoutEffect(() => {
    let targetSelector: string | null = null;
    if (spotlight) {
      if (spotlight.kind === 'source') {
        targetSelector = `[data-tutorial-target="source-${spotlight.index}"]`;
      } else if (spotlight.kind === 'row') {
        targetSelector = `[data-tutorial-target="row-${spotlight.index}"]`;
      } else if (spotlight.kind === 'floor') {
        targetSelector = `[data-tutorial-target="floor"]`;
      } else if (spotlight.kind === 'wall') {
        targetSelector = `[data-tutorial-target="wall"]`;
      }
    }

    const updatePosition = () => {
      const popoverEl = popoverRef.current;
      if (!popoverEl) return;

      const targetEl = targetSelector ? document.querySelector<HTMLElement>(targetSelector) : null;

      if (!targetEl) {
        setCoords({ x: 0, y: 0, placement: 'center' });
        return;
      }

      const targetRect = targetEl.getBoundingClientRect();
      const popoverRect = popoverEl.getBoundingClientRect();
      const margin = 14;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Try placements in preferred order: right -> left -> top -> bottom
      let chosenPlacement: Placement = 'right';
      let x = targetRect.right + margin;
      let y = targetRect.top + targetRect.height / 2 - popoverRect.height / 2;

      // Check if right overflows viewport
      if (x + popoverRect.width > vw - 16) {
        // Try left
        if (targetRect.left - popoverRect.width - margin > 16) {
          chosenPlacement = 'left';
          x = targetRect.left - popoverRect.width - margin;
          y = targetRect.top + targetRect.height / 2 - popoverRect.height / 2;
        } else if (targetRect.top - popoverRect.height - margin > 60) {
          // Try top
          chosenPlacement = 'top';
          x = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
          y = targetRect.top - popoverRect.height - margin;
        } else {
          // Bottom
          chosenPlacement = 'bottom';
          x = targetRect.left + targetRect.width / 2 - popoverRect.width / 2;
          y = targetRect.bottom + margin;
        }
      }

      // Constrain within viewport bounds
      x = Math.max(12, Math.min(x, vw - popoverRect.width - 12));
      y = Math.max(12, Math.min(y, vh - popoverRect.height - 12));

      setCoords({ x, y, placement: chosenPlacement });
    };

    updatePosition();

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [spotlight, stepIndex, phase, body]);

  const isCenter = coords?.placement === 'center' || !coords;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Lesson Coach"
      aria-live="polite"
      style={
        isCenter
          ? {
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 30,
          }
          : {
            position: 'fixed',
            left: `${coords.x}px`,
            top: `${coords.y}px`,
            zIndex: 30,
          }
      }
      className="fixed z-30 w-[calc(100vw-24px)] max-w-sm rounded-xl bg-neutral-900 p-4 text-neutral-100 shadow-[0_18px_48px_rgba(0,0,0,0.45)] transition-[left,top] duration-200 ease-out"
    >
      {/* Arrow Indicator when anchored next to a target */}
      {!isCenter && coords && (
        <div
          className={`absolute pointer-events-none w-3 h-3 bg-neutral-900 transform rotate-45 ${coords.placement === 'right'
            ? '-left-1.5 top-1/2 -translate-y-1/2'
            : coords.placement === 'left'
              ? '-right-1.5 top-1/2 -translate-y-1/2'
              : coords.placement === 'top'
                ? '-bottom-1.5 left-1/2 -translate-x-1/2'
                : '-top-1.5 left-1/2 -translate-x-1/2'
            }`}
        />
      )}

      <div className="mb-4 h-1 overflow-hidden rounded-full bg-neutral-700" aria-hidden="true">
        <div
          className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
          style={{ width: `${((stepIndex + 1) / stepCount) * 100}%` }}
        />
      </div>

      <div className="flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold leading-tight tracking-[-0.02em] text-white">
          {step.title}
        </h2>
        <span className="shrink-0 text-xs tabular-nums text-neutral-400">
          {stepIndex + 1} / {stepCount}
        </span>
      </div>

      <ul className="mt-2.5 space-y-1.5 text-sm leading-5 text-neutral-300">
        {body.map((paragraph, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-sky-400 select-none font-semibold text-base leading-5">➛</span>
            <span className="flex-1 leading-snug">{paragraph}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-end gap-3">
        <div className="flex items-center gap-2">
          {done ? (
            <>
              <Link
                to="/practice"
                className="rounded-lg bg-sky-500 px-3.5 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-400 transition-colors"
              >
                Play Practice
              </Link>
              <Link
                to="/daily"
                className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                Today's Daily
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={next}
              disabled={!canAdvance}
              className="rounded-lg bg-sky-500 px-5 py-2 text-sm font-semibold text-sky-950 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={restart}
        title="Start tutorial over"
        className="mt-3 text-xs text-neutral-500 underline decoration-neutral-700 underline-offset-4 hover:text-neutral-300"
      >
        Start over
      </button>
    </div>
  );
}
