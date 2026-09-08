/**
 * The one place that talks to the OS share sheet.
 *
 * macOS Safari does not fetch a link preview for a Web Share payload: hand it
 * `{title, text, url}` and the sheet fills the thumbnail slot with the *source
 * app's* icon — the Safari compass — no matter how good the page's `og:image`
 * is. The only way to put a real image in that slot is to put a real file in
 * the payload, so `share()` attaches the site's OG card when the browser will
 * take files and silently sends the plain link when it will not.
 */

const OG_IMAGE = '/og.png';

/** One fetch per session; the card is the same bytes for every share. */
let cardPromise: Promise<File | null> | null = null;

function ogCard(): Promise<File | null> {
  cardPromise ??= (async () => {
    try {
      const response = await fetch(OG_IMAGE);
      if (!response.ok) return null;
      const blob = await response.blob();
      return new File([blob], 'quadro.png', { type: blob.type || 'image/png' });
    } catch {
      // Offline, or the card is not in the cache yet. The link still shares.
      return null;
    }
  })();
  return cardPromise;
}

/**
 * Opens the native share sheet.
 *
 * Returns `true` once the sheet has handled the share, `false` if there is no
 * sheet or the user dismissed it — the caller falls back to the clipboard.
 */
export async function share(data: {
  title: string;
  text: string;
  url: string;
}): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;

  const file = await ogCard();
  // `canShare` is the only honest test: a browser that ignores `files` reports
  // the payload as unshareable rather than dropping the attachment, and Safari
  // throws on a payload it accepted the check for only if the user cancels.
  if (file && navigator.canShare?.({ ...data, files: [file] })) {
    try {
      await navigator.share({ ...data, files: [file] });
      return true;
    } catch (error) {
      // A dismissal is an answer. Re-opening the sheet without the image would
      // mean the user has to cancel the same share twice, so only a genuine
      // failure — a sheet that accepted `canShare` and then refused the file —
      // falls through to the plain-link attempt below.
      if ((error as DOMException | undefined)?.name === 'AbortError') return false;
    }
  }

  if (!navigator.canShare?.(data)) return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false;
  }
}
