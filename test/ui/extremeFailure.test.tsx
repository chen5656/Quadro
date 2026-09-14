import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { Daily } from '../../src/routes/Daily';
import { Practice } from '../../src/routes/Practice';
import { RouterProvider } from '../../src/router';
import { storage } from '../../src/storage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each(['daily', 'practice'])('keeps %s controls usable after an Extreme worker failure without recording a result', async (route) => {
  vi.stubGlobal('Worker', undefined);
  const recorded = vi.spyOn(storage, 'incrementDailyAttempts');
  window.history.pushState({}, '', `/${route}?level=extreme&seed=4242`);
  const user = userEvent.setup();
  render(<RouterProvider>{route === 'daily' ? <Daily /> : <Practice />}</RouterProvider>);
  // Practice may deal the AI the opening turn; Daily starts with the human.
  if (!screen.queryByRole('alert')) {
    const take = screen.getAllByRole('button', { name: /^Take \d/ }).find((b) => !b.hasAttribute('disabled'));
    if (take) {
      await user.click(take);
      const target = within(screen.getByRole('region', { name: 'You' }))
        .getAllByRole('button', { name: /Context line/ }).find((b) => !b.hasAttribute('disabled'))!;
      await user.click(target);
    }
  }
  expect((await screen.findByRole('alert')).textContent).toContain('No weaker move was played');
  expect(screen.getByRole('button', { name: 'Restart' })).toBeTruthy();
  expect(recorded).not.toHaveBeenCalled();
});
