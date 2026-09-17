/** Cookie-backed guest sessions. No public account or provider endpoints. */
import type { BetterAuthOptions } from 'better-auth';
import { anonymous } from 'better-auth/plugins/anonymous';

export interface AuthSecrets {
  BETTER_AUTH_SECRET?: string;
  ALLOWED_ORIGIN?: string;
}

export function authOptions(env: AuthSecrets): BetterAuthOptions {
  const origin = env.ALLOWED_ORIGIN ?? 'https://acgame.win';
  return {
    appName: 'QUADRO',
    baseURL: origin,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [origin],
    // Retain the existing database shape; no profile updates are exposed.
    user: { additionalFields: { nickname: { type: 'string', required: false, input: false } } },
    emailAndPassword: { enabled: false },
    account: { accountLinking: { enabled: false } },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: origin.startsWith('https://'),
      defaultCookieAttributes: { sameSite: 'lax' },
    },
    plugins: [anonymous()],
  };
}
