import { useEffect } from 'react';

export type Hotkey = {
  /** Key to match against event.key (case-insensitive). e.g. "n", "Escape", "ArrowDown". */
  key: string;
  /** Required modifier state. Unspecified = "must be off". */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (e: KeyboardEvent) => void;
  /** When true, fire even if an input/textarea/select has focus. */
  inInput?: boolean;
};

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (typeof el.tagName === 'string' && EDITABLE_TAGS.has(el.tagName)) return true;
  if (el.isContentEditable === true) return true;
  return false;
}

export type HotkeyEvent = {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: EventTarget | null;
};

export function matchesHotkey(hk: Hotkey, e: HotkeyEvent): boolean {
  if (hk.key.toLowerCase() !== e.key.toLowerCase()) return false;
  if (!!hk.ctrl !== e.ctrlKey) return false;
  if (!!hk.shift !== e.shiftKey) return false;
  if (!!hk.alt !== e.altKey) return false;
  if (!!hk.meta !== e.metaKey) return false;
  if (!hk.inInput && isEditableTarget(e.target)) return false;
  return true;
}

/**
 * Global keyboard-hotkey binding. ADR 009 §6 requires every action to have
 * a hotkey; this is the small helper that powers screen-level bindings.
 * Hotkeys don't fire while an input is focused unless `inInput` is set.
 */
export function useHotkeys(hotkeys: Hotkey[], enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent): void => {
      for (const hk of hotkeys) {
        if (matchesHotkey(hk, e)) {
          hk.handler(e);
          break;
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hotkeys, enabled]);
}
