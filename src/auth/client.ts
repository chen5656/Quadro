/**
 * The better-auth browser client.
 *
 * Sessions are an HttpOnly cookie on the app's own origin, so there is no key
 * to build in and nothing for the client to hold: every call to `/api/auth/*`
 * is same-origin and the cookie rides along on its own.
 */

import { createAuthClient } from 'better-auth/react';
import { anonymousClient, inferAdditionalFields } from 'better-auth/client/plugins';

/** Same-origin in production; in dev Vite proxies `/api` to the Worker. */
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '';

export const authClient = createAuthClient({
  baseURL: BASE || window.location.origin,
  basePath: '/api/auth',
  plugins: [
    anonymousClient(),
    // Keeps `session.user.nickname` typed; it is our field, not better-auth's.
    inferAdditionalFields({
      user: { nickname: { type: 'string', required: false } },
    }),
  ],
});

export const { signIn, signOut, signUp, useSession, updateUser } = authClient;

/** Display names for the providers the Worker reports as configured. */
export const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google',
  apple: 'Apple',
  linkedin: 'LinkedIn',
};

/**
 * Which providers this deployment actually has credentials for. Asking the
 * Worker rather than hardcoding a list is what keeps a button from appearing
 * for a provider whose redirect would dead-end in a 500.
 */
export async function fetchProviders(): Promise<string[]> {
  try {
    const response = await fetch(`${BASE}/api/providers`, { credentials: 'include' });
    if (!response.ok) return [];
    /**
     * Not just defensive typing. A misrouted `/api/*` is answered by the SPA
     * fallback with `200` and index.html, so `response.ok` is true and the body
     * is HTML — parsing it throws, and an unhandled throw here used to leave
     * `providers` at its initial empty array, silently dropping the Google and
     * Apple buttons from the sign-in dialog. An empty list is the same visible
     * outcome, but it arrives as a value instead of an unhandled rejection.
     */
    const body = (await response.json()) as { social?: string[] };
    return Array.isArray(body.social) ? body.social : [];
  } catch {
    return [];
  }
}
