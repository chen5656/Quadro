/**
 * Board interaction and the Practice surface (§19 "UI component").
 *
 * jsdom has no `Worker`, so `AiClient` falls back to main-thread search here —
 * which is also the fallback path AC-037 requires to work.
 */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Practice } from '../../src/routes/Practice';
import { RouterProvider } from '../../src/router';
import { formatElapsed } from '../../src/components/Timer';

afterEach(() => {
  cleanup();
  // Node's own localStorage shim can shadow jsdom's; the app tolerates either.
  try {
    window.localStorage.clear?.();
  } catch {
    /* nothing remembered, nothing to clear */
  }
  vi.restoreAllMocks();
});

async function startPractice(level = 'easy', seed = '4242') {
  window.history.pushState({}, '', `/practice?level=${level}&seed=${seed}`);
  const user = userEvent.setup();
  render(
    <RouterProvider>
      <Practice />
    </RouterProvider>,
  );
  return user;
}

describe('practice entry & controls', () => {
  it('starts the game straight away and shows board controls', () => {
    window.history.pushState({}, '', '/practice?level=easy&seed=4242');
    render(
      <RouterProvider>
        <Practice />
      </RouterProvider>,
    );
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Game seed' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'You' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Easy' })).toBeInTheDocument();
  });

  it('normalizes URL with level and seed parameters on direct entry', async () => {
    window.history.pushState({}, '', '/practice');
    render(
      <RouterProvider>
        <Practice />
      </RouterProvider>,
    );
    await waitFor(() => {
      const search = window.location.search;
      expect(search).toContain('level=');
      expect(search).toContain('seed=');
    });
  });

  it('supports legacy ai= query parameter and upgrades it to level=', async () => {
    window.history.pushState({}, '', '/practice?ai=hard&seed=98765');
    render(
      <RouterProvider>
        <Practice />
      </RouterProvider>,
    );
    expect(screen.getByRole('region', { name: 'Hard' })).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.search).toContain('level=hard');
      expect(window.location.search).not.toContain('ai=');
    });
  });

  it('opens the Deal Seed modal and allows entering a custom seed', async () => {
    window.history.pushState({}, '', '/practice?level=easy&seed=4242');
    const user = userEvent.setup();
    render(
      <RouterProvider>
        <Practice />
      </RouterProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Deal seed' }));

    expect(screen.queryByText(/Opponent level:/i)).not.toBeInTheDocument();
    const seedInput = screen.getByLabelText(/Seed number/);
    expect(seedInput).toHaveValue('4242');

    await user.clear(seedInput);
    await user.type(seedInput, '8888');
    await user.click(screen.getByRole('button', { name: 'Play deal' }));

    await waitFor(() => {
      expect(window.location.search).toContain('seed=8888');
    });
  });

  it('generates a new random deal when clicking New', async () => {
    window.history.pushState({}, '', '/practice?level=easy&seed=4242');
    const user = userEvent.setup();
    render(
      <RouterProvider>
        <Practice />
      </RouterProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'New' }));

    await waitFor(() => {
      expect(window.location.search).not.toContain('seed=4242');
    });
  });

  it('validates seed range in Deal Seed modal and disables Play deal if invalid', async () => {
    window.history.pushState({}, '', '/practice?level=easy&seed=4242');
    const user = userEvent.setup();
    render(
      <RouterProvider>
        <Practice />
      </RouterProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Deal seed' }));

    const seedInput = screen.getByLabelText(/Seed number/);
    await user.clear(seedInput);
    await user.type(seedInput, '2147483648');
    expect(seedInput).toBeInvalid();
    expect(screen.getByRole('button', { name: 'Play deal' })).toBeDisabled();

    await user.clear(seedInput);
    await user.type(seedInput, 'abc');
    expect(seedInput).toBeInvalid();
    expect(screen.getByRole('button', { name: 'Play deal' })).toBeDisabled();
  });
});

describe('board interaction', () => {
  it('requires a source before any destination is enabled (§9.2)', async () => {
    await startPractice();
    const myBoard = screen.getByRole('region', { name: 'You' });
    const rows = within(myBoard).getAllByRole('button', { name: /Context line/ });
    expect(rows.every((row) => row.hasAttribute('disabled'))).toBe(true);

    const source = screen.getAllByRole('button', { name: /^Take \d/ })[0];
    await userEvent.click(source);
    expect(within(myBoard).getAllByRole('button', { name: /Context line/ }).some((r) => !r.hasAttribute('disabled'))).toBe(true);
  });

  it('never enables an illegal destination', async () => {
    await startPractice();
    // The opponent's board is never a destination.
    const theirBoard = screen.getByRole('region', { name: 'Easy' });
    await userEvent.click(screen.getAllByRole('button', { name: /^Take \d/ })[0]);
    for (const row of within(theirBoard).getAllByRole('button', { name: /Context line/ })) {
      expect(row).toBeDisabled();
    }
  });

  it('clears a pending selection on Escape', async () => {
    const user = await startPractice();
    const source = screen.getAllByRole('button', { name: /^Take \d/ })[0];
    await user.click(source);
    expect(source).toHaveAttribute('aria-pressed', 'true');
    await user.keyboard('{Escape}');
    expect(source).toHaveAttribute('aria-pressed', 'false');
  });

  it('plays a move and hands the turn to the opponent', async () => {
    const user = await startPractice();
    await user.click(screen.getAllByRole('button', { name: /^Take \d/ })[0]);
    const myBoard = screen.getByRole('region', { name: 'You' });
    const target = within(myBoard)
      .getAllByRole('button', { name: /Context line/ })
      .find((row) => !row.hasAttribute('disabled'))!;
    await user.click(target);
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/your turn|thinking|win|Draw/i),
    );
  });

  it('lets the opponent open when the deal seats it first', async () => {
    // Seed 564659697 deals the first move to seat 1, so the session must run the
    // opponent's turn on its own before the player can touch anything.
    await startPractice('Easy', '564659697');
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toMatch(/Your turn/i),
    );
    const theirBoard = screen.getByRole('region', { name: 'Easy' });
    const staged = within(theirBoard)
      .getAllByRole('button', { name: /Context line/ })
      .some((row) => row.textContent !== '');
    const penalised = within(theirBoard).getByRole('button', { name: /Hallucination line/ });
    expect(staged || penalised.textContent !== '-1-1-2-2-2-3-3').toBe(true);
  });

  it('offers undo control up to 3 times per game', async () => {
    const user = await startPractice();
    const undoButton = screen.getByRole('button', { name: /undo/i });
    expect(undoButton).toBeInTheDocument();
    expect(undoButton).toHaveTextContent('Undo (3)');
    expect(undoButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();

    // Make a move
    await user.click(screen.getAllByRole('button', { name: /^Take \d/ })[0]);
    const myBoard = screen.getByRole('region', { name: 'You' });
    const target = within(myBoard)
      .getAllByRole('button', { name: /Context line/ })
      .find((row) => !row.hasAttribute('disabled'))!;
    await user.click(target);

    await waitFor(() => expect(undoButton).not.toBeDisabled());
    expect(undoButton).toHaveTextContent('Undo (3)');

    // Click Undo
    await user.click(undoButton);
    expect(undoButton).toHaveTextContent('Undo (2)');
  });

  it('makes no network request while playing (AC-007)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = await startPractice();
    await user.click(screen.getAllByRole('button', { name: /^Take \d/ })[0]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('formatElapsed', () => {
  it('formats as mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(461_230)).toBe('07:41');
    expect(formatElapsed(59_999)).toBe('00:59');
    expect(formatElapsed(-5)).toBe('00:00');
  });
});
