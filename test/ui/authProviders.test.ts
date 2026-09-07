/**
 * `fetchProviders` decides which social sign-in buttons the dialog renders, and
 * every failure mode has to land on a value. The one that shipped to
 * production was a misrouted `/api/*`: Pages answered `200` with index.html,
 * `response.ok` was true, and the HTML body threw inside `.json()` — an
 * unhandled rejection that left the provider list at its initial empty array,
 * so Google and Apple silently vanished from the dialog.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchProviders } from '../../src/auth/client';

function mockFetch(response: Partial<Response> | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response as Response))),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchProviders', () => {
  it('returns the configured providers', async () => {
    mockFetch({ ok: true, json: async () => ({ social: ['google', 'apple'] }) });
    await expect(fetchProviders()).resolves.toEqual(['google', 'apple']);
  });

  it('resolves to an empty list when the SPA fallback answers with HTML', async () => {
    mockFetch({
      ok: true,
      json: async () => {
        throw new SyntaxError(`Unexpected token '<', "<!doctype "... is not valid JSON`);
      },
    });
    await expect(fetchProviders()).resolves.toEqual([]);
  });

  it('resolves to an empty list when the request never completes', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    await expect(fetchProviders()).resolves.toEqual([]);
  });

  it('resolves to an empty list on an error status', async () => {
    mockFetch({ ok: false, json: async () => ({ social: ['google'] }) });
    await expect(fetchProviders()).resolves.toEqual([]);
  });

  it('ignores a body whose social field is not a list', async () => {
    mockFetch({ ok: true, json: async () => ({ social: 'google' }) });
    await expect(fetchProviders()).resolves.toEqual([]);
  });
});
