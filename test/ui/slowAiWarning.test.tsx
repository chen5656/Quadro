// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { SlowAiWarning } from '../../src/components/SlowAiWarning';

afterEach(cleanup);

it('lets the player keep waiting without changing difficulty', () => {
  const onWait = vi.fn();
  const onChangeLevel = vi.fn();
  render(<SlowAiWarning open onWait={onWait} onChangeLevel={onChangeLevel} />);
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByText(/10 seconds/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Keep waiting' }));
  expect(onWait).toHaveBeenCalledOnce();
  expect(onChangeLevel).not.toHaveBeenCalled();
});

it('dismisses the warning and opens the existing difficulty picker', () => {
  const onWait = vi.fn();
  const onChangeLevel = vi.fn();
  render(<SlowAiWarning open onWait={onWait} onChangeLevel={onChangeLevel} />);
  fireEvent.click(screen.getByRole('button', { name: 'Choose another AI' }));
  expect(onWait).toHaveBeenCalledOnce();
  expect(onChangeLevel).toHaveBeenCalledOnce();
});
