import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { BOT_PROFILES, generateDailyBotScores, seedOrUpdateBots } from '../../worker/bots';
import { currentPuzzleId } from '../../worker/daily';
import { apiRequest, call, migrate } from './helpers';

const TODAY = currentPuzzleId();

beforeEach(async () => {
  await migrate();
});

describe('synthetic house bots', () => {
  it('defines 40 unique USA bot profiles', () => {
    expect(BOT_PROFILES).toHaveLength(40);
    const ids = new Set(BOT_PROFILES.map((b) => b.id));
    expect(ids.size).toBe(40);
    const names = new Set(BOT_PROFILES.map((b) => b.name));
    expect(names.size).toBe(40);
  });

  it('generates scores where board 3 (expert) > board 2 (master) > board 1 (extreme)', () => {
    const scores = generateDailyBotScores(TODAY);
    const expert = scores.filter((s) => s.aiLevel === 'expert');
    const master = scores.filter((s) => s.aiLevel === 'master');
    const extreme = scores.filter((s) => s.aiLevel === 'extreme');

    expect(extreme.length).toBeGreaterThanOrEqual(6);
    expect(master.length).toBeGreaterThan(extreme.length);
    expect(expert.length).toBeGreaterThan(master.length);

    for (const score of scores) {
      expect(score.elapsedMs).toBeGreaterThan(120_000);
      expect(score.rounds).toBeGreaterThanOrEqual(5);
      expect(score.attempts).toBeGreaterThanOrEqual(1);
    }

    // Expert board has wide score spread: 100+ vs 50+ (top) and 50+ vs 10s (casual)
    const hasTopExpert = expert.some((s) => s.finalScore >= 100 && s.opponentScore >= 50);
    const hasLowAiExpert = expert.some((s) => s.finalScore >= 50 && s.opponentScore >= 10 && s.opponentScore < 20);
    expect(hasTopExpert).toBe(true);
    expect(hasLowAiExpert).toBe(true);
  });

  it('seeds bots into D1 with hidden is_bot = 1 flag and serves them on leaderboard', async () => {
    const seededCount = await seedOrUpdateBots(env.DB, TODAY);
    expect(seededCount).toBeGreaterThan(30);

    // Verify is_bot column in D1 database
    const botRows = await env.DB.prepare('SELECT COUNT(*) as n FROM scores WHERE is_bot = 1').first<{ n: number }>();
    expect(botRows?.n).toBe(seededCount);

    // Board 1 (extreme) - least players
    const respExtreme = await call(apiRequest(`/api/leaderboard?ai=extreme&puzzle_id=${TODAY}`));
    expect(respExtreme.status).toBe(200);
    const bodyExtreme = await respExtreme.json<{ entries: unknown[]; total_entries: number }>();

    // Board 2 (master) - middle players
    const respMaster = await call(apiRequest(`/api/leaderboard?ai=master&puzzle_id=${TODAY}`));
    expect(respMaster.status).toBe(200);
    const bodyMaster = await respMaster.json<{ entries: unknown[]; total_entries: number }>();

    // Board 3 (expert) - most players
    const respExpert = await call(apiRequest(`/api/leaderboard?ai=expert&puzzle_id=${TODAY}`));
    expect(respExpert.status).toBe(200);
    const bodyExpert = await respExpert.json<{ entries: { display_name: string; rank: number }[]; total_entries: number }>();

    // Board 3 (expert) has strictly more people than Board 2 (master) and Board 1 (extreme)
    expect(bodyExpert.total_entries).toBeGreaterThan(bodyMaster.total_entries);
    expect(bodyMaster.total_entries).toBeGreaterThan(bodyExtreme.total_entries);
  });
});
