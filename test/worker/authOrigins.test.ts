/**
 * Which origins may talk to the guest session endpoint.
 *
 * `POST /api/guest` mints a session cookie, so a cross-site page must not be
 * able to create one on a player's behalf. Asserted on the handler directly:
 * it is the only place the check lives.
 */

import { describe, expect, it } from 'vitest';

import { requireOrigin } from '../../worker/auth';
import { HttpError } from '../../worker/http';

const ORIGIN = 'https://acgame.win';
const env = { ALLOWED_ORIGIN: ORIGIN } as unknown as Env;

function postFrom(origin?: string): void {
  const request = new Request(`${ORIGIN}/api/guest`, {
    method: 'POST',
    headers: origin ? { origin } : {},
  });
  requireOrigin(request, env);
}

describe('guest session origin check', () => {
  it('accepts the app origin', () => {
    expect(() => postFrom(ORIGIN)).not.toThrow();
  });

  it('rejects a cross-site origin', () => {
    expect(() => postFrom('https://evil.example')).toThrow(HttpError);
  });

  it('rejects a missing origin', () => {
    expect(() => postFrom()).toThrow(HttpError);
  });
});
