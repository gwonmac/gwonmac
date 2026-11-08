/**
 * Which layer holds each cell of the keyboard contract (keyboard-contract.golden.json): every
 * key in every view, one table, split between two runners that read and update the same file.
 * vitest (src/hub-keyboard-contract.ts) drives the real Hub fixture in happy-dom and holds every
 * cell whose answer is DOM, focus and the Hub's own key handling. Playwright
 * (hub-keyboard-contract.spec.ts) holds the cells only a real browser answers.
 */
export const KEYBOARD_VIEWS = [
  'closed', 'home', 'home-query', 'home-row', 'explorable-home', 'travel', 'characters', 'build-library', 'build-page',
  'person', 'accounts', 'settings', 'calculator', 'trade', 'whispers', 'whispers-query', 'review-details', 'settings-body',
] as const;
export type KeyboardView = typeof KEYBOARD_VIEWS[number];

/** The browser's own Tab traversal, and PageDown, whose page is as many rows as the layout shows. */
export const BROWSER_KEYS = ['Tab', 'Shift+Tab', 'PageDown'] as const;
export const DOM_KEYS = ['a', '1', 'Enter', 'Escape', 'Backspace', 'Meta+Backspace', 'ArrowDown', 'ArrowUp',
  'Home', 'End', 'Control+n', 'Meta+Enter', 'Meta+j', 'Meta+r'] as const;
/** Cells of DOM keys that still need rendering: Settings' arrows skip controls the stylesheet hides. */
export const BROWSER_CELLS: readonly (readonly [KeyboardView, typeof DOM_KEYS[number]])[] = [['settings-body', 'ArrowDown']];

export const browserCell = (view: KeyboardView, key: string) =>
  (BROWSER_KEYS as readonly string[]).includes(key) || BROWSER_CELLS.some(([cellView, cellKey]) => cellView === view && cellKey === key);
