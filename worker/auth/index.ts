/** Private session implementation for automatic browser guests. */
import { betterAuth } from 'better-auth';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';

import { HttpError, json } from '../http';
import { authOptions } from './options';

function buildAuth(env: Env) {
  return betterAuth({
    ...authOptions(env),
    database: {
      db: new Kysely({ dialect: new D1Dialect({ database: env.DB }) }),
      type: 'sqlite' as const,
    },
  });
}

const instances = new WeakMap<D1Database, ReturnType<typeof buildAuth>>();
function getAuth(env: Env) {
  let auth = instances.get(env.DB);
  if (!auth) {
    auth = buildAuth(env);
    instances.set(env.DB, auth);
  }
  return auth;
}

export interface Session {
  userId: string;
  displayName: string;
  imageUrl: string | null;
  isAnonymous: boolean;
}

export function displayNameFor(user: { id: string }): string {
  return `player-${user.id.slice(-6)}`;
}

export async function verifyRequest(request: Request, env: Env): Promise<Session | null> {
  const result = await getAuth(env).api.getSession({ headers: request.headers });
  if (!result?.user) return null;
  return {
    userId: result.user.id,
    displayName: displayNameFor(result.user),
    imageUrl: null,
    isAnonymous: true,
  };
}

export async function requireSession(request: Request, env: Env): Promise<Session> {
  const session = await verifyRequest(request, env);
  if (!session) throw new HttpError(401, 'UNAUTHENTICATED', 'A browser guest session is required');
  return session;
}

/** Mutations must originate from the app, not a third-party page. */
export function requireOrigin(request: Request, env: Env): void {
  if (request.headers.get('origin') !== env.ALLOWED_ORIGIN) {
    throw new HttpError(403, 'INVALID_ORIGIN', 'Request origin is not allowed');
  }
}

export async function guestSession(request: Request, env: Env): Promise<Response> {
  if (request.method === 'POST') requireOrigin(request, env);
  const auth = getAuth(env);
  // Use the response form so session renewal cookies reach the browser too.
  const current = await auth.api.getSession({ headers: request.headers, asResponse: true });
  const data = await current.json() as { user?: { id: string } } | null;
  if (data?.user) return guestResponse(data.user, current);
  if (request.method === 'GET') {
    throw new HttpError(401, 'UNAUTHENTICATED', 'No browser guest session');
  }
  // The library owns random identifiers, signed HttpOnly cookies and expiry.
  // Only this fixed anonymous operation is exposed, never its general router.
  const created = await auth.handler(new Request(`${env.ALLOWED_ORIGIN}/api/auth/sign-in/anonymous`, {
    method: 'POST',
    headers: { origin: env.ALLOWED_ORIGIN, 'content-type': 'application/json' },
    body: '{}',
  }));
  if (!created.ok) return created;
  const result = await created.json() as { user: { id: string } };
  return guestResponse(result.user, created);
}

function guestResponse(user: { id: string }, source: Response): Response {
  const response = json({ displayName: displayNameFor(user), imageUrl: null });
  response.headers.set('cache-control', 'no-store');
  for (const cookie of source.headers.getSetCookie()) response.headers.append('set-cookie', cookie);
  return response;
}
