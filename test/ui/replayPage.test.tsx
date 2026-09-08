/**
 * `/r/<code>` end to end.
 *
 * The point of these is that the replay is drawn by the *real* board: the page
 * decodes a code, rebuilds the position with the engine and hands it to
 * `Board`, so a viewer sees the same surface the game was played on. They also
 * pin the two refusals — a damaged code and a code from another engine version
 * — because playing either back would render a game that never happened.
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GreedyAgent } from '../../src/ai';
import { QuadroGame } from '../../src/engine';
import { encodeReplay } from '../../src/replay/codec';
import { ENGINE_VERSION } from '../../src/replay/version';
import { ReplayPage } from '../../src/routes/ReplayPage';
import { RouterProvider } from '../../src/router';

vi.mock('../../src/auth', () => ({
  useIdentity: () => ({
    signedIn: false,
    ready: true,
    isAnonymous: false,
    displayName: null,
    imageUrl: null,
    hasNickname: false,
    openSignIn: () => {},
    openAccount: () => {},
  }),
}));

afterEach(() => {
  cleanup();
  window.location.hash = '';
});

/** A real finished game, encoded the way the app encodes one. */
function codeForGame(engineVersion = ENGINE_VERSION) {
  const game = new QuadroGame(4242, 0);
  const agent = new GreedyAgent(1, 0);
  while (!game.isOver()) game.step(agent.choose(game.state, game.state.current));
  const result = game.result();
  return {
    game,
    code: encodeReplay({
      engineVersion,
      seed: game.seed,
      firstPlayer: game.firstPlayer,
      humanSeat: 0,
      aiLevel: 'extreme',
      scores: [result.scores[0], result.scores[1]],
      puzzleId: '2026-08-28',
      actions: game.history.map((a) => a.actionId),
    }),
  };
}

function renderAt(code: string) {
  window.history.pushState({}, '', `/r/${code}`);
  return render(
    <RouterProvider>
      <ReplayPage />
    </RouterProvider>,
  );
}

/**
 * Open the link and press play, which is what a viewer does before there is
 * any board to talk about: `/r/<code>` opens on the result card.
 */
async function watch(code: string) {
  const user = userEvent.setup();
  renderAt(code);
  await user.click(await screen.findByRole('button', { name: /watch the replay/i }));
  await screen.findByText(/move 0 \//);
  return user;
}

describe('the replay page', () => {
  it('leads with the score and the opponent, not with a board', async () => {
    const { code, game } = codeForGame();
    const result = game.result();
    renderAt(code);

    // The link is a boast. Whoever opened it came for this line.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      new RegExp(`Extreme ${result.scores[0]}.${result.scores[1]}`),
    );
    expect(screen.getByText('Extreme', { selector: 'div' })).toBeInTheDocument();
    // Nothing is playing, and no board is on screen to play on.
    expect(screen.queryByRole('button', { name: 'Play' })).not.toBeInTheDocument();
    expect(screen.queryByText(/move 0 \//)).not.toBeInTheDocument();
  });

  it('shows where the points came from, round by round', async () => {
    const { code, game } = codeForGame();
    renderAt(code);

    await screen.findByText(/How the score was built/i);
    // Every round the game actually had, plus the end-game bonus that the
    // rounds alone never account for.
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`Round ${game.result().rounds}`))).toBeInTheDocument();
    expect(screen.getByText(/End-game bonus/i)).toBeInTheDocument();
  });

  it('reports the score the moves produce, not the score the link claims', async () => {
    // A hand-edited claim is the one thing a shared link makes easy to forge,
    // and the card is what most people will ever see of it.
    const { game } = codeForGame();
    const result = game.result();
    const forged = encodeReplay({
      engineVersion: ENGINE_VERSION,
      seed: game.seed,
      firstPlayer: game.firstPlayer,
      humanSeat: 0,
      aiLevel: 'extreme',
      scores: [200, 1],
      puzzleId: '2026-08-28',
      actions: game.history.map((a) => a.actionId),
    });
    renderAt(forged);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      new RegExp(`Extreme ${result.scores[0]}.${result.scores[1]}`),
    );
    expect(screen.queryByText('200')).not.toBeInTheDocument();
  });

  it('starts at the opening deal, not the finished position', async () => {
    const { code, game } = codeForGame();
    await watch(code);

    expect(screen.getByText(new RegExp(`move 0 / ${game.history.length}`))).toBeInTheDocument();
  });

  it('plays once asked, without a second press', async () => {
    const { code } = codeForGame();
    await watch(code);

    // Pressing "Watch the replay" is the whole instruction: the board is not
    // handed over as a still frame with another button to find.
    await waitFor(
      () => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument(),
      { timeout: 3000 },
    );
    await waitFor(() => expect(screen.getByText(/move [1-9]\d* \//)).toBeInTheDocument(), {
      timeout: 5000,
    });
  });

  it('leaves a viewer who steps first in control, without autoplay taking over', async () => {
    const { code } = codeForGame();
    const user = await watch(code);

    await user.click(screen.getByRole('button', { name: 'Step' }));
    await waitFor(() => expect(screen.getByText(/move 1 \//)).toBeInTheDocument());

    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getByText(/move 1 \//)).toBeInTheDocument();
  });

  it('advances one recorded move at a time', async () => {
    const { code } = codeForGame();
    const user = await watch(code);

    // Playback starts once asked, so stepping is what a viewer does *after*
    // taking control: pause first, then step from wherever they paused.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument(), {
      timeout: 3000,
    });
    await user.click(screen.getByRole('button', { name: 'Pause' }));
    // Let the move that was already in flight land before reading the cursor.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const paused = Number(/move (\d+) \//.exec(document.body.textContent ?? '')?.[1]);

    await user.click(screen.getByRole('button', { name: 'Step' }));
    await waitFor(() =>
      expect(screen.getByText(new RegExp(`move ${paused + 1} /`))).toBeInTheDocument(),
    );
  });

  it('seeks to any move and back to the start', async () => {
    const { code } = codeForGame();
    const user = await watch(code);

    await user.click(screen.getByRole('button', { name: 'Step' }));
    await waitFor(() => expect(screen.getByText(/move 1 \//)).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Restart' }));
    await waitFor(() => expect(screen.getByText(/move 0 \//)).toBeInTheDocument());
  });

  it('refuses a replay recorded by a different engine version', async () => {
    const { code } = codeForGame(ENGINE_VERSION + 1);
    renderAt(code);

    expect(
      await screen.findByText(/from an older version of the game/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /watch the replay/i })).not.toBeInTheDocument();
  });

  it('refuses a damaged link rather than drawing a wrong board', async () => {
    renderAt('this-is-not-a-replay');
    expect(await screen.findByText(/link is damaged/i)).toBeInTheDocument();
  });

  it('explains an empty link', async () => {
    renderAt('');
    expect(await screen.findByText(/No replay in this link/i)).toBeInTheDocument();
  });
});
