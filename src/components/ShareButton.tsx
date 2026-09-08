/**
 * The one share control in the app.
 *
 * Native share sheet where the browser has one, clipboard everywhere else,
 * with the button itself as the confirmation — a toast for something this
 * small is more interruption than information.
 */

import { useState } from 'react';

import { SITE_NAME } from '../site';

export function ShareButton({
  url,
  text,
  label = 'Share',
  title = 'Share this game',
  className = 'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:bg-neutral-800 hover:text-white',
}: {
  url: string;
  /** The recap line pasted next to the link. */
  text: string;
  label?: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const onClick = async () => {
    const data = { title: SITE_NAME, text, url };
    if (typeof navigator === 'undefined') return;
    if (navigator.share && navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        return;
      } catch {
        // Dismissed, or the sheet failed. Fall through to the clipboard.
      }
    }
    // A clipboard write can be refused outright — an insecure origin, or a
    // browser that wants a permission this click did not carry. Saying
    // "Copied!" when nothing was copied is worse than saying nothing, so the
    // label only changes once the write has actually resolved.
    if (!navigator.clipboard) {
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    }
  };

  return (
    <button type="button" onClick={() => void onClick()} title={title} className={className}>
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 stroke-current"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      <span>{copied ? 'Copied!' : failed ? 'Copy failed' : label}</span>
    </button>
  );
}
