/**
 * Sharing the game itself, rather than one game of it.
 *
 * Every other share control in the app carries a replay: a score, an opponent,
 * a link that plays a specific match back. Someone who simply wants to tell a
 * friend the site exists had nothing to press — the only way to pass it on was
 * to copy the address bar.
 */

import { ShareButton } from './ShareButton';
import { SITE_NAME } from '../site';

const PITCH = `${SITE_NAME} — a free tile-drafting strategy game against an AI opponent. One deal a day, the same for everyone.`;

export function ShareSite({
  label = `Share ${SITE_NAME}`,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <ShareButton
      url={typeof window === 'undefined' ? 'https://acgame.win' : window.location.origin}
      text={PITCH}
      label={label}
      title="Share the game"
      className={className}
    />
  );
}
