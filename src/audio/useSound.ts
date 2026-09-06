/**
 * React bindings for `audio`.
 *
 * The settings live in the singleton, not in a provider, so a component that
 * only makes noise can import `sfx` and skip this entirely. `useSound` exists
 * for the two places that must re-render when the switches move.
 */

import { useEffect, useSyncExternalStore } from 'react';

import { audio, type MusicId, type SoundSettings } from './audio';

export function useSound(): SoundSettings & {
  setMusic: (on: boolean) => void;
  setSfx: (on: boolean) => void;
  muteAll: () => void;
} {
  const settings = useSyncExternalStore(audio.subscribe, () => audio.get(), () => audio.get());
  return {
    ...settings,
    setMusic: (on) => audio.setMusic(on),
    setSfx: (on) => audio.setSfx(on),
    muteAll: () => audio.muteAll(),
  };
}

/**
 * Ask for a bed while this component is mounted.
 *
 * Nothing is stopped on unmount: routes hand over to each other, and stopping
 * first would put a hole between two tracks that are meant to cross-fade. The
 * bed only stops when the player turns music off.
 */
export function useMusic(id: MusicId | null): void {
  useEffect(() => {
    if (!id) return;
    void audio.playMusic(id);
  }, [id]);
}
