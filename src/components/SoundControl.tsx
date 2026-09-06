/**
 * The two sound switches, for the settings menu.
 *
 * Two toggles rather than one three-way control: "everything off" is both off,
 * "effects only off" is music left on, and the player who wants effects without
 * a soundtrack — the common case on a long game — is served by the same UI.
 */

import { sfx, useSound } from '../audio';

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-2 text-xs font-medium text-neutral-400 hover:text-neutral-200"
    >
      <span>{label}</span>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => {
          // Clicked before the flip, so turning effects *on* is audible and
          // turning them off is not the last thing you hear.
          if (!checked) sfx('ui');
          onChange(!checked);
        }}
        className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-sky-400 bg-sky-500/70' : 'border-neutral-700 bg-neutral-800'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-neutral-100 transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

export function SoundControl() {
  const { music, sfx: sfxOn, setMusic, setSfx } = useSound();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Sound
        </span>
        {(music || sfxOn) && (
          <button
            type="button"
            onClick={() => {
              setMusic(false);
              setSfx(false);
            }}
            className="text-[11px] text-neutral-500 underline-offset-2 hover:text-neutral-300 hover:underline"
          >
            Mute all
          </button>
        )}
      </div>
      <Toggle id="sound-music" label="Music" checked={music} onChange={setMusic} />
      <Toggle id="sound-sfx" label="Sound effects" checked={sfxOn} onChange={setSfx} />
    </div>
  );
}
