/**
 * The name of the game, in one place.
 *
 * It reaches people outside the app — the OS share sheet's heading, the recap
 * line pasted next to a shared link — where a stale name is not a cosmetic
 * slip but the wrong product being recommended. A rename that has to find
 * every string literal will miss one; this is the string it should find.
 *
 * The static build keeps its own copy in `seo/site.mjs`, which nothing in the
 * bundle can import.
 */
export const SITE_NAME = 'QUADRO';
