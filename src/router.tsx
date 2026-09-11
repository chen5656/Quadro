/**
 * A ~50-line history router.
 *
 * A handful of static routes and no nested layouts (§9.1), so a routing library would
 * cost more bundle than it saves (NFR-001). Cloudflare Pages serves index.html
 * for unknown paths, which is what makes the deep links work (AC-036).
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type Route =
  | '/'
  | '/tutorial'
  | '/daily'
  | '/practice'
  /** `/r/<code>`; the replay code arrives in `params.code`. */
  | '/r'
  | '/history';

const ROUTES: Route[] = [
  '/',
  '/tutorial',
  '/daily',
  '/practice',
  '/history',
];

export interface RouteParams {
  /** The base64url replay code, on `/r/<code>` only. */
  code?: string;
}

/**
 * `/r/<code>`. The code sits in the path rather than the fragment so the
 * Worker can decode it and answer a link preview with this game's score
 * (`worker/share.ts`); a fragment never reaches the server.
 */
const SHARED_REPLAY = /^\/r\/([A-Za-z0-9_-]+)$/;

function normalize(pathname: string): { route: Route; params: RouteParams } {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  if (trimmed === '/leaderboard' || trimmed.startsWith('/leaderboard/')) {
    return { route: '/daily', params: {} };
  }
  const shared = SHARED_REPLAY.exec(trimmed);
  if (shared) return { route: '/r', params: { code: shared[1] } };
  return { route: (ROUTES.find((r) => r === trimmed) ?? '/') as Route, params: {} };
}

interface NavigateOptions {
  replace?: boolean;
}

interface RouterValue {
  route: Route;
  params: RouteParams;
  search: string;
  /** Without the leading '#'. Replay codes ride here so they stay out of logs. */
  hash: string;
  navigate: (to: string, options?: NavigateOptions) => void;
}

const RouterContext = createContext<RouterValue>({
  route: '/',
  params: {},
  search: '',
  hash: '',
  navigate: () => {},
});

const ROUTE_TITLES: Record<Route, string> = {
  '/': 'Quadro board game — a free tile-drafting strategy game against an AI opponent',
  '/daily': 'Daily Challenge — QUADRO',
  '/practice': 'Practice — QUADRO',
  '/tutorial': 'Learn to play QUADRO — a guided round',
  '/r': 'Replay — QUADRO',
  '/history': 'Match History — QUADRO',
};

export function RouterProvider({ children }: { children: ReactNode }) {
  const [match, setMatch] = useState(() => normalize(window.location.pathname));
  const [search, setSearch] = useState<string>(() => window.location.search);
  const [hash, setHash] = useState<string>(() => window.location.hash.replace(/^#/, ''));

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = ROUTE_TITLES[match.route] || 'QUADRO';
    }
  }, [match.route]);

  useEffect(() => {
    const onPop = () => {
      setMatch(normalize(window.location.pathname));
      setSearch(window.location.search);
      setHash(window.location.hash.replace(/^#/, ''));
    };
    window.addEventListener('popstate', onPop);
    // A replay link pasted into the address bar changes only the fragment, so
    // popstate alone would leave the page showing the previous replay.
    window.addEventListener('hashchange', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onPop);
    };
  }, []);

  const navigate = useCallback((to: string, options?: NavigateOptions) => {
    const url = new URL(to, window.location.href);
    if (
      window.location.pathname !== url.pathname ||
      window.location.search !== url.search ||
      window.location.hash !== url.hash
    ) {
      if (options?.replace) {
        window.history.replaceState({}, '', to);
      } else {
        window.history.pushState({}, '', to);
      }
    }
    setMatch(normalize(url.pathname));
    setSearch(url.search);
    setHash(url.hash.replace(/^#/, ''));
    if (!options?.replace) {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <RouterContext.Provider
      value={{ route: match.route, params: match.params, search, hash, navigate }}
    >
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter(): RouterValue {
  return useContext(RouterContext);
}

/** An anchor that navigates in-place but still behaves like a real link. */
export function Link({
  to,
  className,
  title,
  'aria-label': ariaLabel,
  onClick,
  children,
}: {
  /** Any in-app href, not just a bare `Route`: dated boards and replay links
   *  carry a path segment or a fragment. */
  to: string;
  className?: string;
  title?: string;
  'aria-label'?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  children: ReactNode;
}) {
  const { navigate } = useRouter();
  return (
    <a
      href={to}
      className={className}
      title={title}
      aria-label={ariaLabel}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
