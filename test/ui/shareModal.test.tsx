/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShareModal } from '../../src/components/ShareModal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShareModal', () => {
  it('places color grids under url in the preview and copied text when grid is provided', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const text = 'Quadro Daily 2026-09-14\n🏆 Victory vs Master · 85–62 (+23)';
    const url = 'https://acgame.win/r/12345';
    const grid = '🟦🟨🟥🟩⬛\n🟨🟥🟩⬛🟦';

    const { container } = render(
      <ShareModal
        isOpen={true}
        onClose={() => {}}
        url={url}
        text={text}
        grid={grid}
      />,
    );

    const previewEl = container.querySelector('.max-h-48');
    expect(previewEl).not.toBeNull();
    const previewContent = previewEl?.textContent ?? '';
    const textIdx = previewContent.indexOf('Quadro Daily 2026-09-14');
    const urlIdx = previewContent.indexOf(url);
    const gridIdx = previewContent.indexOf('🟦🟨🟥🟩⬛');

    expect(textIdx).toBeGreaterThan(-1);
    expect(urlIdx).toBeGreaterThan(textIdx);
    expect(gridIdx).toBeGreaterThan(urlIdx);

    const copyButton = screen.getByRole('button', { name: /copy text/i });
    act(() => {
      fireEvent.click(copyButton);
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copiedText = writeTextMock.mock.calls[0][0];
    const copiedTextIdx = copiedText.indexOf('Quadro Daily 2026-09-14');
    const copiedUrlIdx = copiedText.indexOf(url);
    const copiedGridIdx = copiedText.indexOf('🟦🟨🟥🟩⬛');

    expect(copiedUrlIdx).toBeGreaterThan(copiedTextIdx);
    expect(copiedGridIdx).toBeGreaterThan(copiedUrlIdx);
  });

  it('automatically splits grid from text if grid was embedded in text and puts it under url', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const embeddedText =
      'Quadro Daily 2026-09-14\n🏆 Victory vs Master · 85–62 (+23)\n\n🟦🟨🟥🟩⬛\n🟨🟥🟩⬛🟦';
    const url = 'https://acgame.win/r/12345';

    const { container } = render(
      <ShareModal
        isOpen={true}
        onClose={() => {}}
        url={url}
        text={embeddedText}
      />,
    );

    const previewEl = container.querySelector('.max-h-48');
    const previewContent = previewEl?.textContent ?? '';
    const urlIdx = previewContent.indexOf(url);
    const gridIdx = previewContent.indexOf('🟦🟨🟥🟩⬛');

    expect(urlIdx).toBeGreaterThan(-1);
    expect(gridIdx).toBeGreaterThan(urlIdx);

    const copyButton = screen.getByRole('button', { name: /copy text/i });
    act(() => {
      fireEvent.click(copyButton);
    });

    expect(writeTextMock).toHaveBeenCalledTimes(1);
    const copied = writeTextMock.mock.calls[0][0];
    expect(copied.indexOf(url)).toBeLessThan(copied.indexOf('🟦🟨🟥🟩⬛'));
  });

  it('does not duplicate the grid when grid is both in text and passed as grid prop', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const embeddedText =
      'Quadro Daily 2026-09-14\n🏆 Victory vs Master · 85–62 (+23)\n\n🟦🟨🟥🟩⬛\n🟨🟥🟩⬛🟦';
    const url = 'https://acgame.win/r/12345';
    const grid = '🟦🟨🟥🟩⬛\n🟨🟥🟩⬛🟦';

    const { container } = render(
      <ShareModal
        isOpen={true}
        onClose={() => {}}
        url={url}
        text={embeddedText}
        grid={grid}
      />,
    );

    const previewEl = container.querySelector('.max-h-48');
    const previewContent = previewEl?.textContent ?? '';
    // Count occurrences of the first grid row
    const matches = previewContent.match(/🟦🟨🟥🟩⬛/g);
    expect(matches).toHaveLength(1);

    const copyButton = screen.getByRole('button', { name: /copy text/i });
    act(() => {
      fireEvent.click(copyButton);
    });

    const copied = writeTextMock.mock.calls[0][0];
    const copiedMatches = copied.match(/🟦🟨🟥🟩⬛/g);
    expect(copiedMatches).toHaveLength(1);
  });
});
