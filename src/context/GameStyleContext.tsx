import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { storage } from '../storage';

export type GameStyle = 'focus' | 'classic';

export interface StyleOption {
  value: GameStyle;
  label: string;
  description: string;
}

export const GAME_STYLES: readonly StyleOption[] = [
  {
    value: 'focus',
    label: 'Focus',
    description: 'Subtle colors, letter initials, no avatars/badges.',
  },
  {
    value: 'classic',
    label: 'Classic',
    description: 'Vibrant tiles, AI robot badges, and board watermark badge.',
  },
] as const;

interface GameStyleContextValue {
  style: GameStyle;
  setStyle: (style: GameStyle) => void;
}

const GameStyleContext = createContext<GameStyleContextValue>({
  style: 'classic',
  setStyle: () => {},
});

function applyGameStyleAttr(style: GameStyle) {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-game-style', style);
  }
}

export function GameStyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyleState] = useState<GameStyle>(() => {
    const saved = storage.gameStyle();
    const initial = saved === 'focus' ? 'focus' : 'classic';
    applyGameStyleAttr(initial);
    return initial;
  });

  const setStyle = useCallback((next: GameStyle) => {
    setStyleState(next);
    storage.setGameStyle(next);
    applyGameStyleAttr(next);
  }, []);

  return (
    <GameStyleContext.Provider value={{ style, setStyle }}>
      {children}
    </GameStyleContext.Provider>
  );
}

export function useGameStyle() {
  return useContext(GameStyleContext);
}
