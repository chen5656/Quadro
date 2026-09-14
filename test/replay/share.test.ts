import { describe, expect, it } from 'vitest';
import { recapText, replayWallGridEmoji, shareFor, wallGridEmoji } from '../../src/replay/share';
import { ENGINE_VERSION } from '../../src/replay/version';
import type { Replay } from '../../src/replay/codec';
import { QuadroGame } from '../../src/engine';

describe('share recap formatting', () => {
  const replay: Replay = {
    engineVersion: ENGINE_VERSION,
    seed: 12345,
    firstPlayer: 0,
    humanSeat: 0,
    aiLevel: 'expert',
    scores: [49, 6],
    puzzleId: '2026-09-12',
    actions: [],
  };

  it('formats victory recap with emoji', () => {
    const text = recapText(replay, {
      levelLabel: 'Expert',
      elapsedMs: 204000,
      rounds: 5,
    });
    expect(text).toContain('QUADRO Daily 2026-09-12');
    expect(text).toContain('🏆 Victory vs Expert · 49–6 (+43)');
    expect(text).toContain('⏱️ 3:24 · 5 Rounds');
  });

  it('formats defeat recap with medal emoji', () => {
    const defeatReplay: Replay = {
      ...replay,
      scores: [20, 35],
    };
    const text = recapText(defeatReplay, {
      levelLabel: 'Expert',
    });
    expect(text).toContain('🥈 Defeat vs Expert · 20–35 (-15)');
  });

  it('generates wall emoji grid from a 5x5 boolean grid', () => {
    const grid: boolean[][] = [
      [true, false, false, false, false],
      [false, true, false, false, false],
      [false, false, true, false, false],
      [false, false, false, true, false],
      [false, false, false, false, true],
    ];
    const emoji = wallGridEmoji(grid);
    const lines = emoji.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0].startsWith('🟦')).toBe(true);
  });

  it('places color grids under url in recapText when url is provided', () => {
    const grid: boolean[][] = [
      [true, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
      [false, false, false, false, false],
    ];
    const url = 'https://acgame.win/r/testcode';
    const text = recapText(replay, {
      levelLabel: 'Expert',
      wallGrid: grid,
      url,
    });

    const urlIdx = text.indexOf(url);
    const gridIdx = text.indexOf('🟦');

    expect(urlIdx).toBeGreaterThan(-1);
    expect(gridIdx).toBeGreaterThan(-1);
    expect(urlIdx).toBeLessThan(gridIdx);
  });

  it('shareFor returns separate url, text, and grid payload', () => {
    const game = new QuadroGame(12345);
    const share = shareFor(
      game,
      { aiLevel: 'expert', humanSeat: 0, puzzleId: '2026-09-12' },
      { levelLabel: 'Expert' },
    );

    expect(share).not.toBeNull();
    expect(share?.url).toContain('/r/');
    expect(share?.text).toContain('QUADRO Daily 2026-09-12');
    expect(share?.grid).toBeDefined();
    expect(share?.grid?.split('\n')).toHaveLength(5);
  });

  it('replayWallGridEmoji returns null when no actions exist', () => {
    expect(replayWallGridEmoji(replay)).toBeNull();
  });
});

