/**
 * `/api/*` router for the QUADRO Daily (§13).
 *
 * Four endpoints and a nightly cron. Every handler returns a structured error
 * rather than throwing past the runtime, so a bug never becomes an opaque 1101.
 */

import { enabledProviders, getAuth, requireSession, verifyRequest } from './auth';
import { deleteAvatars, serveAvatar, uploadAvatar } from './avatar';
import { purgeOldRows } from './cron';
import { currentPuzzleId, isPuzzleId, nextRolloverMs, seedForPuzzle } from './daily';
import { HttpError, corsHeaders, fail, json } from './http';
import { AI_LEVELS, DEFAULT_AI_LEVEL, isAiLevel, leaderboard } from './leaderboard';
import { history } from './history';
import { deleteMe, submitScore } from './scores';
import { replayCodeFrom, shareReplayPage } from './share';

/**
 * The service worker served at `https://www.acgame.win/sw.js`.
 *
 * Its whole job is to undo itself. `skipWaiting` in `install` puts it in
 * control without waiting for the old worker's clients to close, then
 * `activate` clears the precache, unregisters the registration, and reloads
 * every open `www` tab. The reload is a plain navigation with no worker left to
 * intercept it, so it reaches the network and takes the 308 to the apex.
 */
const TOMBSTONE_SW = `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) client.navigate(client.url);
  })());
});
`;

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    /**
     * `www` is not a second home for the app; it is a detour to the real one.
     *
     * This route exists only to send it back. The Worker's `/api/*` route is
     * declared on the apex alone, so a request to `www.acgame.win/api/providers`
     * never reached this file — Pages answered it with the SPA fallback, `200`
     * and index.html, and `fetchProviders` threw parsing HTML as JSON. The
     * visible symptom was a sign-in dialog with no Google or Apple button on
     * `https://www.acgame.win/` while `https://acgame.win/` was fine.
     *
     * Redirecting beats serving the app on both hosts: the session cookie,
     * `ALLOWED_ORIGIN` and better-auth's `baseURL` are all bound to the apex, so
     * a `www` copy would reach the Worker and then fail social sign-in on the
     * origin check instead. One canonical host, one cookie. `308` rather than
     * `301` so a POST arrives as a POST, and it runs before the CORS and
     * `OPTIONS` handling below because there is nothing on this host to permit.
     */
    const host = new URL(request.url).hostname;
    if (host.startsWith('www.')) {
      const target = new URL(request.url);
      target.hostname = host.slice('www.'.length);

      /**
       * `/sw.js` is the one path on `www` that must not be redirected.
       *
       * A player who ever opened `www` has the PWA's service worker registered
       * on that origin, precached app shell and all. It answers navigations
       * from the cache, so the redirect above never runs: the app keeps
       * rendering on `www`, and its `/api/*` calls are redirected to the apex
       * mid-flight, where CSP blocks them as cross-origin. That is the state
       * this endpoint exists to end.
       *
       * Redirecting `sw.js` would make it permanent. A browser refuses to
       * register a service worker whose script is behind a redirect, so the
       * stale worker could never be replaced and would serve its cached shell
       * forever. Instead `www` gets a real script that is a tombstone: it drops
       * every cache, unregisters itself, and reloads the open tabs, which then
       * finally reach the 308. `no-store` keeps this answer out of the HTTP
       * cache, and the bytes differ from the precache worker, which is what
       * makes the browser take it as an update at all.
       */
      if (target.pathname === '/sw.js') {
        return new Response(TOMBSTONE_SW, {
          headers: {
            'content-type': 'text/javascript; charset=utf-8',
            'cache-control': 'no-store',
          },
        });
      }

      return Response.redirect(target.toString(), 308);
    }

    /**
     * `/r/<code>` is an HTML page, not an API call: it is the SPA shell with
     * this replay's own link-preview tags written into the head
     * (`worker/share.ts`). Handled here, above the CORS wrapper, because a
     * document served to the address bar has no origin to permit.
     */
    const replayCode = replayCodeFrom(new URL(request.url).pathname);
    if (replayCode && (request.method === 'GET' || request.method === 'HEAD')) {
      return shareReplayPage(request, replayCode);
    }

    const cors = corsHeaders(env.ALLOWED_ORIGIN);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const response = await route(request, env);
      for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
      return response;
    } catch (err) {
      if (err instanceof HttpError) {
        const response = err.toResponse();
        for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
        return response;
      }
      console.error(
        JSON.stringify({ level: 'error', message: 'unhandled', error: String(err) }),
      );
      return fail(500, 'INTERNAL', 'Something went wrong');
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      purgeOldRows(env.DB).then((deleted) => {
        console.log(JSON.stringify({ level: 'info', message: 'retention sweep', ...deleted }));
      }),
    );
  },
} satisfies ExportedHandler<Env>;

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  // Sign-in, sign-out, OAuth callbacks, session, and profile updates. Handed
  // over whole: better-auth owns every route under its base path, and the list
  // grows with the plugins it is configured with.
  if (url.pathname.startsWith('/api/auth/')) {
    return (await getAuth(env)).handler(request);
  }

  // Which sign-in buttons to render. A provider whose credentials are not set
  // must not show a button: the redirect would dead-end in a 500.
  if (path === '/api/providers' && request.method === 'GET') {
    return json({ social: enabledProviders(env), email_password: true });
  }

  if (path.startsWith('/api/avatar/') && request.method === 'GET') {
    return serveAvatar(env, path.slice('/api/avatar/'.length));
  }
  if (path === '/api/daily' && request.method === 'GET') {
    const puzzleId = currentPuzzleId();
    return json({
      puzzle_id: puzzleId,
      seed: seedForPuzzle(puzzleId),
      opponent: 'extreme',
      next_rollover_ms: nextRolloverMs(),
    });
  }

  if (path === '/api/leaderboard' && request.method === 'GET') {
    const requested = url.searchParams.get('puzzle_id');
    if (requested !== null && !isPuzzleId(requested)) {
      throw new HttpError(422, 'INVALID_PAYLOAD', 'puzzle_id must be YYYY-MM-DD');
    }
    // Auth is optional here: the board reads without it, and `me` is simply
    // absent (FR-036, AC-025).
    const ai = url.searchParams.get('ai');
    if (ai !== null && !isAiLevel(ai)) {
      throw new HttpError(422, 'INVALID_PAYLOAD', `ai must be one of ${AI_LEVELS.join(', ')}`);
    }
    const session = await verifyRequest(request, env).catch(() => null);
    return leaderboard(
      env.DB,
      requested ?? currentPuzzleId(),
      Number(url.searchParams.get('limit') ?? 100),
      session,
      ai ?? DEFAULT_AI_LEVEL,
    );
  }

  if (path === '/api/scores' && request.method === 'POST') {
    const session = await requireSession(request, env);
    const body = await request.json().catch(() => null);
    return submitScore(env.DB, session, body);
  }

  if (
    path === '/api/me/history' && request.method === 'GET'
  ) {
    const session = await requireSession(request, env);
    const before = url.searchParams.get('before');
    if (before !== null && !isPuzzleId(before)) {
      throw new HttpError(422, 'INVALID_PAYLOAD', 'before must be YYYY-MM-DD');
    }
    const limitParam = url.searchParams.get('limit');
    return history(env.DB, session, {
      limit: limitParam === null ? undefined : Number(limitParam),
      before,
    });
  }

  if (path === '/api/me/avatar' && request.method === 'PUT') {
    const session = await requireSession(request, env);
    return uploadAvatar(env, session, request, async (image) => {
      // Written through better-auth so its hooks and the cached session cookie
      // both see the new value.
      await (await getAuth(env)).api.updateUser({
        body: { image },
        headers: request.headers,
      });
    });
  }

  if (path === '/api/me' && request.method === 'DELETE') {
    const session = await requireSession(request, env);
    await deleteAvatars(env, session.userId).catch(() => {});
    return deleteMe(env.DB, session);
  }

  return fail(404, 'NOT_FOUND', 'No such endpoint');
}
