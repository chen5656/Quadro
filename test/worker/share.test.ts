/**
 * `/r/<code>`: which paths are replay links, and what their link preview says.
 *
 * The page itself is the SPA shell rewritten by `HTMLRewriter`; what is worth
 * pinning here is the part that would silently rot — the path shape, and the
 * card text a player's followers actually see.
 */

import { describe, expect, it } from 'vitest';

import { cardFor, replayCodeFrom } from '../../worker/share';
import type { Replay } from '../../src/replay/codec';
import { ENGINE_VERSION } from '../../src/replay/version';

const REPLAY: Replay = {
  engineVersion: ENGINE_VERSION,
  seed: 12345,
  firstPlayer: 0,
  humanSeat: 0,
  aiLevel: 'extreme',
  scores: [62, 48],
  puzzleId: '2026-09-02',
  actions: [],
};

describe('replayCodeFrom', () => {
  it('takes a replay code out of the path', () => {
    expect(replayCodeFrom('/r/AQEGOTAAAA')).toBe('AQEGOTAAAA');
    expect(replayCodeFrom('/r/AQEGOTAAAA/')).toBe('AQEGOTAAAA');
  });

  it('leaves every other path alone', () => {
    for (const path of ['/', '/r', '/r/', '/replay/abc', '/api/daily', '/r/a/b']) {
      expect(replayCodeFrom(path)).toBeNull();
    }
  });

  it('rejects characters that are not in the base64url alphabet', () => {
    expect(replayCodeFrom('/r/<script>')).toBeNull();
    expect(replayCodeFrom('/r/abc.def')).toBeNull();
  });

  it('refuses a code longer than a submitted replay may be', () => {
    expect(replayCodeFrom(`/r/${'A'.repeat(1025)}`)).toBeNull();
    expect(replayCodeFrom(`/r/${'A'.repeat(1024)}`)).not.toBeNull();
  });
});

describe('the link preview card', () => {
  it('leads with the score and the opponent', () => {
    const card = cardFor(REPLAY);
    expect(card.title).toBe('62–48 vs Extreme — QUADRO');
    expect(card.description).toContain('beat Extreme 62–48');
    expect(card.description).toContain('Daily 2026-09-02');
  });

  it('reads from the sharer’s seat, not seat 0', () => {
    expect(cardFor({ ...REPLAY, humanSeat: 1 }).title).toBe('48–62 vs Extreme — QUADRO');
    expect(cardFor({ ...REPLAY, humanSeat: 1 }).description).toContain('lost to Extreme');
  });

  it('says so when the scores are level', () => {
    expect(cardFor({ ...REPLAY, scores: [50, 50] }).description).toContain('drew with');
  });

  it('does not call a practice game a daily deal', () => {
    expect(cardFor({ ...REPLAY, puzzleId: null }).description).toContain('a practice deal');
  });

  it('does not leak the deal itself into the preview', () => {
    // A card is read by everyone who sees the link, including people who have
    // not played that day yet. The result is fair game; the seed that would
    // let someone precompute the deal is not.
    const card = cardFor(REPLAY);
    expect(`${card.title} ${card.description}`).not.toContain(String(REPLAY.seed));
  });
});
