/**
 * `GET /r/<code>` — the shareable replay page.
 *
 * The SPA can render a replay from the code alone; what it cannot do is answer
 * a link preview. A crawler runs no JavaScript, so before this handler existed
 * every shared game produced the same generic site card — the same title, the
 * same picture — no matter who beat whom.
 *
 * So the Worker takes this one path. It decodes the code (the very same
 * `decodeReplay` the score check in `replay.ts` runs), fetches the built SPA
 * shell from Pages, and rewrites the head: this game's score in the title, its
 * opponent and date in the description. The human still gets the whole app —
 * one document, no redirect, no second request.
 *
 * A code that does not decode is not an error worth a 404: the link still leads
 * somewhere real. It falls through with the site's own card, and the SPA shows
 * the "damaged link" state.
 */

import { decodeReplay, type Replay } from '../src/replay/codec';
import { ENGINE_VERSION } from '../src/replay/version';
import { MAX_REPLAY_CHARS } from './replay';

const SITE_NAME = 'QUADRO';
const OG_IMAGE = '/og.png';

const LEVEL_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
  master: 'Master',
  extreme: 'Extreme',
};

/** `/r/<code>` -> the code, or null when this is not a replay path. */
export function replayCodeFrom(pathname: string): string | null {
  const match = /^\/r\/([A-Za-z0-9_-]+)\/?$/.exec(pathname);
  if (!match) return null;
  // The same ceiling the submit endpoint enforces, so a hostile URL cannot
  // hand the decoder an unbounded string.
  return match[1].length <= MAX_REPLAY_CHARS ? match[1] : null;
}

export interface Card {
  title: string;
  description: string;
}

/**
 * What the card says.
 *
 * The margin and the opponent, because that is the boast; the date, because it
 * says which deal it was. Not a word about how it was won — the recap text the
 * player pastes is deliberately spoiler-free (`src/replay/share.ts`), and a
 * preview that gave the day's deal away would undo that.
 */
export function cardFor(replay: Replay): Card {
  const mine = replay.scores[replay.humanSeat];
  const theirs = replay.scores[1 - replay.humanSeat];
  const opponent = LEVEL_LABELS[replay.aiLevel] ?? replay.aiLevel;
  const verdict = mine > theirs ? 'beat' : mine < theirs ? 'lost to' : 'drew with';
  const deal = replay.puzzleId ? `Daily ${replay.puzzleId}` : 'a practice deal';

  return {
    title: `${mine}–${theirs} vs ${opponent} — ${SITE_NAME}`,
    description: `A player ${verdict} ${opponent} ${mine}–${theirs} on ${deal}. Watch every move of the game, then take the same deal yourself.`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Rewrites the SPA shell's head for this replay.
 *
 * The shell is the home page's HTML — `scripts/seo-build.mjs` writes the
 * site's own card into it — so the existing tags are *removed* rather than
 * added to. Two `og:title`s in one document is a coin toss over which one a
 * crawler believes.
 */
function rewrite(response: Response, card: Card, url: string): Response {
  const tags = [
    `<meta name="description" content="${escapeHtml(card.description)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:title" content="${escapeHtml(card.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(card.description)}" />`,
    `<meta property="og:image" content="${escapeHtml(new URL(OG_IMAGE, url).toString())}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(card.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(card.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(new URL(OG_IMAGE, url).toString())}" />`,
    // A single replay is not a page worth indexing — there are as many of them
    // as there are games — but the links in it are worth following.
    `<meta name="robots" content="noindex,follow" />`,
  ].join('');

  return new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(card.title);
      },
    })
    .on(
      'meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], meta[name="robots"], script[type="application/ld+json"]',
      {
        element(el) {
          el.remove();
        },
      },
    )
    // The shell's crawler-visible first paint describes the home page. React
    // wipes it on mount, but a crawler reads it, so it must not claim to be
    // something this page is not.
    .on('.seo-fallback', {
      element(el) {
        el.setInnerContent(
          `<h1 style="font-size:2rem;margin:0 0 .5rem">${escapeHtml(card.title)}</h1>` +
            `<p style="color:#a3a3a3;line-height:1.6">${escapeHtml(card.description)}</p>` +
            `<ul style="line-height:1.9"><li><a href="/daily">Play today's puzzle</a></li>` +
            `<li><a href="/practice">Practice against the AI</a></li></ul>`,
          { html: true },
        );
      },
    })
    .on('head', {
      element(el) {
        el.append(tags, { html: true });
      },
    })
    .transform(response);
}

/**
 * Serve `/r/<code>`.
 *
 * The shell comes from Pages at `/index.html`, which is outside this Worker's
 * routes, so the subrequest cannot recurse back into here.
 *
 * That is a production shape, not a local one: `wrangler dev` answers every
 * path with this Worker, so the shell fetch lands back on the API router and
 * 404s. Develop this page against `npm run dev` (Vite serves the SPA and the
 * router renders the replay); the card itself is covered by
 * `test/worker/share.test.ts`.
 */
export async function shareReplayPage(request: Request, code: string): Promise<Response> {
  const url = new URL(request.url);
  const shell = await fetch(new URL('/index.html', url).toString(), {
    headers: { accept: 'text/html' },
  });

  if (!shell.ok) return shell;

  let replay: Replay;
  try {
    replay = decodeReplay(code, ENGINE_VERSION);
  } catch {
    // Damaged, or recorded by an engine whose rules have since changed. The
    // SPA explains which; the card stays generic.
    return new Response(shell.body, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
    });
  }

  const rewritten = rewrite(
    new Response(shell.body, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    cardFor(replay),
    url.toString(),
  );

  return new Response(rewritten.body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // A replay never changes: the code *is* the game.
      'cache-control': 'public, max-age=3600',
    },
  });
}
