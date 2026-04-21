import { describe, expect, it, vi } from 'vitest';
import { type Hotkey, type HotkeyEvent, isEditableTarget, matchesHotkey } from './useHotkeys';

function ev(overrides: Partial<HotkeyEvent>): HotkeyEvent {
  return {
    key: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    target: null,
    ...overrides,
  };
}

describe('matchesHotkey', () => {
  const handler = vi.fn();
  const n: Hotkey = { key: 'n', handler };
  const ctrlS: Hotkey = { key: 's', ctrl: true, handler };
  const escInInput: Hotkey = { key: 'Escape', inInput: true, handler };

  it('matches bare key', () => {
    expect(matchesHotkey(n, ev({ key: 'n' }))).toBe(true);
  });

  it('is case-insensitive on the key', () => {
    expect(matchesHotkey(n, ev({ key: 'N' }))).toBe(true);
  });

  it('requires modifiers to be exactly as specified', () => {
    expect(matchesHotkey(n, ev({ key: 'n', ctrlKey: true }))).toBe(false);
    expect(matchesHotkey(ctrlS, ev({ key: 's' }))).toBe(false);
    expect(matchesHotkey(ctrlS, ev({ key: 's', ctrlKey: true }))).toBe(true);
    expect(matchesHotkey(ctrlS, ev({ key: 's', ctrlKey: true, shiftKey: true }))).toBe(false);
  });

  it('skips when an input is focused by default', () => {
    const input = { tagName: 'INPUT' };
    expect(matchesHotkey(n, ev({ key: 'n', target: input as unknown as EventTarget }))).toBe(false);
  });

  it('fires in input when inInput is true', () => {
    const input = { tagName: 'INPUT' };
    expect(
      matchesHotkey(escInInput, ev({ key: 'Escape', target: input as unknown as EventTarget })),
    ).toBe(true);
  });
});

describe('isEditableTarget', () => {
  it('detects input/textarea/select', () => {
    expect(isEditableTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' } as unknown as EventTarget)).toBe(true);
  });

  it('detects contenteditable', () => {
    expect(
      isEditableTarget({
        tagName: 'DIV',
        isContentEditable: true,
      } as unknown as EventTarget),
    ).toBe(true);
  });

  it('returns false for null / non-editable targets', () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget({ tagName: 'DIV' } as unknown as EventTarget)).toBe(false);
  });
});
