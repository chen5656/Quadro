/**
 * `www` must never serve the app.
 *
 * The Worker's `/api/*` route is declared on the apex, so before the
 * `www.acgame.win/*` route existed, a request to `www` never reached this
 * Worker at all: Pages answered `/api/providers` with the SPA fallback — `200`
 * and index.html — and the client threw parsing HTML as JSON, leaving the
 * sign-in dialog with no Google or Apple button on `www` while the apex was
 * fine.
 */

import { describe, expect, it } from 'vitest';

import { call } from './helpers';

describe('the www redirect', () => {
  it('sends a www request back to the apex', async () => {
    const response = await call(new Request('https://www.acgame.win/api/providers'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://acgame.win/api/providers');
  });

  it('keeps the path and the query string', async () => {
    const response = await call(new Request('https://www.acgame.win/daily?ai=extreme'));
    expect(response.headers.get('location')).toBe('https://acgame.win/daily?ai=extreme');
  });

  it('redirects a POST without downgrading it to a GET', async () => {
    // 308, not 301: a 301 lets the browser retry a POST as a GET, which would
    // turn a sign-in submission into a silent no-op.
    const response = await call(
      new Request('https://www.acgame.win/api/scores', { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(308);
  });

  it('serves a self-unregistering worker at /sw.js instead of redirecting it', async () => {
    // A browser refuses to register a service worker whose script is behind a
    // redirect, so a 308 here would freeze the stale www worker in place
    // forever, still serving its precached shell.
    const response = await call(new Request('https://www.acgame.win/sw.js'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');
    expect(response.headers.get('cache-control')).toBe('no-store');

    const body = await response.text();
    expect(body).toContain('registration.unregister()');
    expect(body).toContain('caches.delete');
  });

  it('still redirects the apex service worker path untouched', async () => {
    const response = await call(new Request('https://acgame.win/sw.js'));
    // The apex `sw.js` is a Pages asset; the Worker only routes `/api/*` there,
    // so this never reaches a handler that would shadow the real thing.
    expect(response.status).not.toBe(200);
  });

  it('leaves the apex alone', async () => {
    const response = await call(new Request('https://acgame.win/api/providers'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ email_password: true });
  });
});
