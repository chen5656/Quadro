import { lazy, Suspense, useEffect, type ReactNode } from 'react';

import { AppBanners } from './components/AppBanners';
import { SettingsMenu } from './components/SettingsMenu';
import { useAttemptRunning } from './game/attemptGuard';
import { AuthControl } from './auth';
import { Home } from './routes/Home';
import { Link, useRouter } from './router';
import { ShareSite } from './components/ShareSite';
import { useLayoutMode } from './components/useLayoutMode';
import { useGameStyle } from './context/GameStyleContext';
import { useMusic } from './audio';

/*
  Home is the only route that has to be in the initial bundle — it is what a
  first visit lands on. The rest are fetched when they are navigated to, which
  keeps the tutorial script, the replay decoder, the history list and the result
  card off the critical path of every page load (NFR-001).
*/
const loadDaily = () => import('./routes/Daily');
const loadHistory = () => import('./routes/HistoryPage');
const loadPractice = () => import('./routes/Practice');
const loadReplay = () => import('./routes/ReplayPage');
const loadTutorial = () => import('./routes/Tutorial');

const Daily = lazy(() => loadDaily().then((m) => ({ default: m.Daily })));
const HistoryPage = lazy(() => loadHistory().then((m) => ({ default: m.HistoryPage })));
const Practice = lazy(() => loadPractice().then((m) => ({ default: m.Practice })));
const ReplayPage = lazy(() => loadReplay().then((m) => ({ default: m.ReplayPage })));
const Tutorial = lazy(() => loadTutorial().then((m) => ({ default: m.Tutorial })));

/**
 * Fetch the other routes once the browser has nothing better to do.
 *
 * Splitting them keeps them off the critical path; warming them on idle keeps
 * the split from being something the player can feel. By the time anyone has
 * read the home page and reached for Daily, the chunk is already in the module
 * cache and the navigation is as immediate as it was when it was all one file.
 */
function useWarmRoutes(): void {
  useEffect(() => {
    const warm = () => {
      void loadDaily();
      void loadPractice();
      void loadTutorial();
      void loadHistory();
      void loadReplay();
    };
    const idle = window.requestIdleCallback;
    if (typeof idle === 'function') {
      const handle = idle(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(warm, 1500);
    return () => window.clearTimeout(timer);
  }, []);
}

/**
 * Deliberately blank.
 *
 * These chunks are a few tens of kilobytes off a cache or a local network, so
 * the wait is normally a frame or two; a spinner in that window is a flash of
 * furniture, not feedback. The layout below already holds the page's shape.
 */
const RouteFallback = <div className="min-h-[60vh]" aria-hidden="true" />;

/** Routes that are a game surface: on phones and tablets they own the screen. */
const GAME_ROUTES = new Set(['/tutorial', '/practice', '/daily']);

function LogoIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="h-6 w-6 rounded"
    >
      <rect width="32" height="32" rx="6" fill="#171717" />
      <rect x="5" y="5" width="10" height="10" rx="2" fill="#2f6fd0" />
      <rect x="17" y="5" width="10" height="10" rx="2" fill="#e8c33a" />
      <rect x="5" y="17" width="10" height="10" rx="2" fill="#c8402f" />
      <rect x="17" y="17" width="10" height="10" rx="2" fill="#e9e6dd" />
    </svg>
  );
}

function Nav() {
  const { route } = useRouter();
  const { style } = useGameStyle();
  const item = (
    to: '/tutorial' | '/daily' | '/practice',
    label: string,
    icon?: ReactNode,
  ) => (
    <Link
      to={to}
      className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-sm ${
        route === to ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400 hover:text-neutral-100'
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  /*
    Three destinations only. Home is the wordmark; preferences sit behind the ⚙.
  */
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center justify-end gap-1">
      {item('/daily', 'Daily', style !== 'focus' ? <span className="text-xs">📅</span> : undefined)}
      {item('/practice', 'Practice', style !== 'focus' ? <span className="text-xs">🎯</span> : undefined)}
      {item('/tutorial', 'Learn', style !== 'focus' ? <span className="text-xs">❓</span> : undefined)}
    </nav>
  );
}

export function App() {
  const { route } = useRouter();
  const attemptRunning = useAttemptRunning();
  useWarmRoutes();
  const { style } = useGameStyle();
  /**
   * On a phone or tablet the nav, style/scale pickers and auth control cost a
   * whole band of screen for something you only touch between games. The game
   * surface hides them and offers its own back link instead.
   */
  const immersive = useLayoutMode() === 'stacked' && GAME_ROUTES.has(route);
  // Two beds, chosen by where the player is: the darker one over a board, the
  // open one everywhere else. Neither can start before the first gesture.
  // The Daily is the exception — it scores itself round by round, so it asks
  // for its own cues and this must not talk over them.
  useMusic(route === '/daily' ? null : GAME_ROUTES.has(route) ? 'game' : 'menu');

  return (
    <div className="min-h-dvh">
      <AppBanners blockUpdates={attemptRunning} />
      {!immersive && (
      <header className="relative z-50 border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-x-3 px-4 py-3">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold tracking-tight text-neutral-100 hover:text-white transition-colors">
            {style !== 'focus' && <LogoIcon />}
            <span>QUADRO</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Nav />
            <SettingsMenu />
            <AuthControl />
          </div>
        </div>
      </header>
      )}

      <main
        className={`mx-auto w-full ${
          GAME_ROUTES.has(route) ? 'max-w-[1600px]' : 'max-w-7xl'
        } ${immersive ? 'px-1.5 pb-[env(safe-area-inset-bottom)] pt-1.5' : 'px-2 sm:px-4 py-3'}`}
      >
        <Suspense fallback={RouteFallback}>
          {route === '/' && <Home />}
          {route === '/tutorial' && <Tutorial />}
          {route === '/practice' && <Practice />}
          {route === '/daily' && <Daily />}
          {route === '/r' && <ReplayPage />}
          {route === '/history' && <HistoryPage />}
        </Suspense>
      </main>

      {/*
        Static pages emitted by the SEO build, outside the router — plain <a>,
        not <Link>, or the router would normalize them to `/` and the policy
        would silently render as the home page. Google's consent screen links
        here too, so it has to be reachable.
      */}
      {!immersive && (
        <footer className="mt-8 border-t border-neutral-800">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 text-xs text-neutral-500">
            <span>QUADRO — A free tile-drafting strategy game against an AI opponent.</span>
            <a href="/guide" className="hover:text-neutral-300">
              Guide
            </a>
            <a href="/privacy" className="hover:text-neutral-300">
              Privacy
            </a>
            <a href="/terms" className="hover:text-neutral-300">
              Terms
            </a>
            <ShareSite
              className="ml-auto inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-800 px-2.5 py-1 text-xs text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200"
            />
          </div>
        </footer>
      )}
    </div>
  );
}
