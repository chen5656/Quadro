/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HistoryPage } from '../../src/routes/HistoryPage';
import { RouterProvider } from '../../src/router';
import * as client from '../../src/api/client';

vi.mock('../../src/auth', () => ({
  useIdentity: () => ({
    signedIn: true,
    ready: true,
    isAnonymous: false,
    displayName: 'Player',
    imageUrl: null,
    hasNickname: true,
    openSignIn: () => {},
    openAccount: () => {},
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HistoryPage Best Score logic', () => {
  it('awards Best Score trophy to the highest score entry per day', async () => {
    vi.spyOn(client, 'getHistory').mockResolvedValue({
      entries: [
        // Day 1: two games, extreme with higher margin should get Best Score
        {
          puzzle_id: '2026-09-10',
          ai_level: 'extreme',
          elapsed_ms: 60000,
          final_score: 80,
          opponent_score: 50,
          margin: 30,
          rounds: 5,
          attempts: 2,
          replay: null,
          verified: true,
          played_at: 1000,
          rank: 1,
        },
        {
          puzzle_id: '2026-09-10',
          ai_level: 'easy',
          elapsed_ms: 50000,
          final_score: 70,
          opponent_score: 50,
          margin: 20,
          rounds: 5,
          attempts: 1,
          replay: null,
          verified: true,
          played_at: 500,
          rank: 1,
        },
        // Day 2: user only played easy, easy should still get Best Score trophy
        {
          puzzle_id: '2026-09-09',
          ai_level: 'easy',
          elapsed_ms: 45000,
          final_score: 60,
          opponent_score: 40,
          margin: 20,
          rounds: 5,
          attempts: 1,
          replay: null,
          verified: true,
          played_at: 200,
          rank: 1,
        },
      ],
      next_before: null,
    });

    window.history.pushState({}, '', '/history');
    render(
      <RouterProvider>
        <HistoryPage />
      </RouterProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Your history')).toBeDefined();
    });

    // There should be exactly 2 "Best Score" badges (one for 2026-09-10 and one for 2026-09-09)
    const bestBadges = screen.getAllByText('Best Score');
    expect(bestBadges).toHaveLength(2);
  });
});
