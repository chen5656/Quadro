import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Home } from '../../src/routes/Home';
import { HeroBoard } from '../../src/components/HeroBoard';

let animate: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  animate = vi.fn(() => ({ onfinish: null, cancel: vi.fn(), pause: vi.fn(), play: vi.fn() }));
  // jsdom does not implement Web Animations. Let the production fallback
  // timers land flights, exercising the actual preview loop and React state.
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
  Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: () => [] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(Element.prototype, 'animate');
  Reflect.deleteProperty(Element.prototype, 'getAnimations');
});

async function advance(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  }
}

it('parks an unattended preview with no recurring timers and resumes on request', async () => {
  render(<Home />);
  await advance(35_000);
  expect(animate).toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Resume game preview' })).toBeInTheDocument();
  const count = animate.mock.calls.length;
  expect(vi.getTimerCount()).toBe(0);
  await advance(5_000);
  expect(animate).toHaveBeenCalledTimes(count);
  fireEvent.click(screen.getByRole('button', { name: 'Resume game preview' }));
  await advance(3_000);
  expect(animate.mock.calls.length).toBeGreaterThan(count);
});

it('parks when hidden and stays parked when returning to the tab', async () => {
  render(<Home />);
  await advance(800);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  const count = animate.mock.calls.length;
  await advance(5_000);
  expect(animate).toHaveBeenCalledTimes(count);
  expect(vi.getTimerCount()).toBe(0);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByRole('button', { name: 'Resume game preview' })).toBeInTheDocument();
});

it('does not poll while manually paused', async () => {
  const view = render(<HeroBoard paused />);
  await advance(1_000);
  expect(animate).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  view.rerender(<HeroBoard paused={false} />);
  await advance(1_000);
  expect(animate).toHaveBeenCalled();
});
