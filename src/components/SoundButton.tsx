import { useEffect, useRef, useState } from 'react';
import { useSound, sfx } from '../audio';
import { SoundControl } from './SoundControl';

export function SoundButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { music, sfx: sfxOn, setMusic, setSfx } = useSound();
  const wrapRef = useRef<HTMLDivElement>(null);

  const isMuted = !music && !sfxOn;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleMute = () => {
    if (isMuted) {
      setMusic(true);
      setSfx(true);
      sfx('ui');
    } else {
      setMusic(false);
      setSfx(false);
    }
  };

  return (
    <div ref={wrapRef} className={`relative inline-flex items-center ${className}`}>
      <div className="inline-flex items-center rounded-lg border border-neutral-700/70 bg-neutral-900/70 shadow-sm transition hover:border-neutral-600">
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
          title={isMuted ? 'Unmute audio' : 'Mute audio'}
          className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-l-lg text-neutral-300 hover:bg-neutral-800 hover:text-white transition ${
            isMuted ? 'text-neutral-500 hover:text-neutral-300' : 'text-sky-400'
          }`}
        >
          {isMuted ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H3.75A1.75 1.75 0 0 0 2 9.25v5.5c0 .966.784 1.75 1.75 1.75h2.69l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM17.28 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-2.22 2.22a.75.75 0 1 0 1.06 1.06L19.5 13.06l2.22 2.22a.75.75 0 1 0 1.06-1.06L20.56 12l2.22-2.22a.75.75 0 0 0-1.06-1.06L19.5 10.94l-2.22-2.22Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H3.75A1.75 1.75 0 0 0 2 9.25v5.5c0 .966.784 1.75 1.75 1.75h2.69l4.5 4.5c.944.945 2.56.276 2.56-1.06V4.06ZM18.5 7.5a.75.75 0 0 0-1.06 1.06 4.5 4.5 0 0 1 0 6.36.75.75 0 0 0 1.06 1.06 6 6 0 0 0 0-8.48ZM20.62 5.38a.75.75 0 0 0-1.06 1.06 7.5 7.5 0 0 1 0 10.61.75.75 0 0 0 1.06 1.06 9 9 0 0 0 0-12.73Z" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            sfx('ui');
            setOpen((v) => !v);
          }}
          aria-label="Sound settings"
          aria-expanded={open}
          aria-haspopup="menu"
          title="Sound settings"
          className={`flex h-7 w-4 sm:h-8 sm:w-5 items-center justify-center rounded-r-lg border-l border-neutral-700/60 text-neutral-400 hover:bg-neutral-800 hover:text-white transition ${
            open ? 'bg-neutral-800 text-neutral-100' : ''
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-2.5 w-2.5 stroke-current transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="menu"
            className="absolute left-0 top-full z-[60] mt-1.5 w-60 rounded-lg border border-neutral-700 bg-neutral-900 p-3 shadow-xl"
          >
            <SoundControl />
          </div>
        </>
      )}
    </div>
  );
}
