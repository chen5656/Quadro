/**
 * Test rig for the Worker: a real local D1 with the production schema.
 *
 * There are no accounts to sign into. A test that needs a session creates a
 * browser guest through the Worker's own `POST /api/guest` and reuses the
 * cookie that comes back, exactly as the app does.
 */

import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';

// Imported as text: workerd has no filesystem, and this keeps the tests running
// against the very files that are applied to production.
import SCHEMA from '../../worker/schema.sql?raw';
import AUTH_SCHEMA from '../../worker/migrations/004_auth.sql?raw';
import worker from '../../worker/index';

export const ORIGIN = 'https://acgame.win';

/** Applies the production schema to the isolated per-test database. */
export async function migrate(): Promise<void> {
  for (const file of [SCHEMA, AUTH_SCHEMA]) {
    for (const statement of file.split(';')) {
      // The generated auth schema is commented; a comment-only chunk is not SQL.
      const sql = statement
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .trim();
      if (sql) await env.DB.prepare(sql).run();
    }
  }
}

export async function call(request: Request): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export interface TestSession {
  /** Ready to send as a `cookie` header. */
  cookie: string;
  userId: string;
  /** The `player-xxxxxx` name the Worker derives from the id. */
  displayName: string;
}

/**
 * Starts a guest session and returns its cookie. Idempotent per cookie jar, so
 * a second call with the returned cookie keeps the same identity.
 */
export async function createGuest(): Promise<TestSession> {
  const response = await call(
    new Request(`${ORIGIN}/api/guest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: '{}',
    }),
  );
  if (!response.ok) {
    throw new Error(`guest session failed: ${response.status} ${await response.text()}`);
  }

  const cookie = sessionCookie(response);
  const body = await response.json<{ displayName: string }>();

  const row = await env.DB.prepare(
    'SELECT id FROM "user" WHERE "isAnonymous" = 1 ORDER BY rowid DESC',
  ).first<{ id: string }>();
  if (!row) throw new Error('guest session left no user row');

  return { cookie, userId: row.id, displayName: body.displayName };
}

/** Every `Set-Cookie` on the response, folded into one `Cookie` header value. */
function sessionCookie(response: Response): string {
  const headers = response.headers.getSetCookie?.() ?? [];
  const pairs = headers.map((header) => header.split(';', 1)[0]).filter(Boolean);
  if (pairs.length === 0) throw new Error('no session cookie was set');
  return pairs.join('; ');
}

/** A request against the Worker, optionally carrying a session. */
export function apiRequest(
  path: string,
  init: RequestInit & { session?: TestSession | null } = {},
): Request {
  const { session, ...rest } = init;
  return new Request(`${ORIGIN}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { 'content-type': 'application/json' } : {}),
      ...(rest.body !== undefined ? { origin: ORIGIN } : {}),
      ...(session ? { cookie: session.cookie } : {}),
      ...rest.headers,
    },
  });
}
