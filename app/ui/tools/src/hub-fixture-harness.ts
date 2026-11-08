/**
 * Mounts the Hub fixture page (hub-fixture.ts, the page the Playwright specs drive at `/?hub`)
 * in happy-dom, with the real Hub controller, views, surface controller and command router, so
 * a vitest test can hold DOM and focus rules that need no real browser. Each mount starts from a
 * clean body and the fixture's own query; the previous mount's Hub, window and document
 * listeners and timers are removed first, so tests never see each other.
 *
 * `press` sends a key the way Playwright's `keyboard.press` does: modifier key-downs, the key's
 * key-down, the browser's default action when nothing prevented it, then the key-ups. The
 * default actions are the few the Hub's contract reads: typing a character or deleting one in a
 * text field, Enter on a button, a summary or a form field, and Escape closing a modal dialog.
 * The browser's own Tab traversal, caret movement and text selection are not modelled: those
 * cells stay in Playwright.
 */
import { vi } from 'vitest';

type Added = readonly [EventTarget, string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined];
const added: Added[] = [];
let tracking = false;
function track() {
  if (tracking) return;
  tracking = true;
  for (const target of [window, document, document.documentElement, document.body] as EventTarget[]) {
    const original = target.addEventListener;
    target.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
      if (listener) added.push([target, type, listener, options]);
      original.call(target, type, listener, options);
    };
  }
}
function release() {
  window.gwHub?.dispose();
  for (const [target, type, listener, options] of added.splice(0)) target.removeEventListener(type, listener, options);
  vi.clearAllTimers();
}

/** Whether an element shows: connected, and no ancestor is hidden, `display: none` inline, or a closed dialog. */
export function shown(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute('hidden') || (node instanceof HTMLElement && node.style.display === 'none')) return false;
    if (node instanceof HTMLDialogElement && !node.open) return false;
  }
  return element.isConnected;
}

/**
 * Two animation frames and the demo hosts' 600 ms travel or apply delays, as the specs wait. A
 * page loaded on demand (Settings, a lazy view) takes real time to import, so each half also
 * waits for imports that started.
 */
export async function settle() {
  for (let half = 0; half < 2; half++) {
    await vi.advanceTimersByTimeAsync(350);
    await vi.dynamicImportSettled();
  }
}

/**
 * The fixture's modules load once per test file, as a page loads them once: what they set up on
 * import (the command router, text editing) stays, and only each mount's own listeners go.
 */
let fixture: typeof import('./hub-fixture') | null = null;

/**
 * Loads the fixture's modules on the real clock and waits for the imports they start, so no
 * test sees a module still loading. Call it from `beforeAll`.
 */
export async function loadFixture() {
  fixture ??= await import('./hub-fixture');
  await vi.dynamicImportSettled();
}

/** Mounts a fresh Hub fixture for `?hub<query>` and waits until it is ready, as the specs' `goto`. */
export async function mountFixture(query = '') {
  release();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'] });
  history.replaceState(null, '', `/?hub${query}`);
  localStorage.clear();
  // happy-dom has neither popovers nor pointer lock; the Hub only needs them to exist.
  HTMLElement.prototype.showPopover ??= function () {};
  HTMLElement.prototype.hidePopover ??= function () {};
  if (document.pointerLockElement === undefined) Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
  document.body.replaceChildren();
  if (!fixture) throw new Error('Call loadFixture() in beforeAll first');
  const { mountHubFixture } = fixture;
  track();
  const app = document.createElement('div'); app.id = 'app'; document.body.append(app);
  mountHubFixture(app);
  await settle();
  if (app.dataset.ready !== 'true') throw new Error('The Hub fixture did not become ready');
  return app;
}
export const unmountFixture = () => { release(); vi.useRealTimers(); };

const MODIFIERS = { Meta: 'metaKey', Control: 'ctrlKey', Alt: 'altKey', Shift: 'shiftKey' } as const;
type Modifier = keyof typeof MODIFIERS;
const CODES: Record<string, string> = { Enter: 'Enter', Escape: 'Escape', Backspace: 'Backspace', Tab: 'Tab', ArrowDown: 'ArrowDown', ArrowUp: 'ArrowUp', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Home: 'Home', End: 'End', PageDown: 'PageDown', PageUp: 'PageUp', Meta: 'MetaLeft', Control: 'ControlLeft', Alt: 'AltLeft', Shift: 'ShiftLeft', ' ': 'Space' };
const code = (key: string) => CODES[key] ?? (/^[a-z]$/iu.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/u.test(key) ? `Digit${key}` : key);
const target = () => document.activeElement ?? document.body;
const textField = (element: Element): element is HTMLInputElement | HTMLTextAreaElement =>
  element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && ['text', 'search', 'url', 'email', 'tel', 'password', ''].includes(element.type));

function send(type: 'keydown' | 'keyup', key: string, held: ReadonlySet<Modifier>, repeat = false) {
  const init: KeyboardEventInit = { key, code: code(key), bubbles: true, cancelable: true, composed: true, repeat };
  for (const modifier of held) init[MODIFIERS[modifier]] = true;
  return target().dispatchEvent(new KeyboardEvent(type, init));
}

/** The browser's default action for an unprevented key-down, for the keys the Hub's contract reads. */
function defaultAction(key: string, held: ReadonlySet<Modifier>) {
  const element = target();
  const plain = held.size === 0 || (held.size === 1 && held.has('Shift'));
  if (key.length === 1 && plain && textField(element)) {
    element.value += key; element.dispatchEvent(new InputEvent('input', { bubbles: true, data: key, inputType: 'insertText' })); return;
  }
  if (key === 'Backspace' && held.size === 0 && textField(element) && element.value) {
    element.value = element.value.slice(0, -1); element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' })); return;
  }
  if (key === 'Enter' && held.size === 0) {
    if (element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement || element.tagName === 'SUMMARY') { (element as HTMLElement).click(); return; }
    if (element instanceof HTMLInputElement && element.form) { element.form.requestSubmit(); return; }
  }
  if (key === 'Escape') {
    const dialog = [...document.querySelectorAll('dialog')].reverse().find(open => open.open && open.matches(':modal'));
    if (dialog && dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
  }
}

/** Presses a chord such as `Meta+Backspace` as Playwright's `keyboard.press` does. */
export function press(chord: string) {
  const parts = chord.split('+');
  const key = parts.pop()!;
  const held = new Set<Modifier>();
  for (const modifier of parts as Modifier[]) { held.add(modifier); send('keydown', modifier, held); }
  if (send('keydown', key, held)) defaultAction(key, held);
  send('keyup', key, held);
  for (const modifier of [...parts as Modifier[]].reverse()) { held.delete(modifier); send('keyup', modifier, held); }
}

/**
 * A key-down without its key-up, as Playwright's `keyboard.down`: a key already down sends an
 * auto-repeat (`repeat: true`), which the browser acts on as it does on the first press.
 */
export function keyDown(key: string, repeat = false) {
  const none = new Set<Modifier>();
  if (send('keydown', key, none, repeat)) defaultAction(key, none);
}
export const keyUp = (key: string) => send('keyup', key, new Set());

/** Holds a key through `repeats` auto-repeats, then releases it. */
export function hold(key: string, repeats = 3) {
  for (let press = 0; press <= repeats; press++) keyDown(key, press > 0);
  keyUp(key);
}

/**
 * Clicks an element as a mouse press does: the press focuses its nearest focusable ancestor
 * (or the body), then the click runs with `detail` as the click run's length.
 */
export function click(element: Element, detail = 1) {
  const init = { bubbles: true, cancelable: true, composed: true, detail, button: 0 };
  element.dispatchEvent(new PointerEvent('pointerdown', init));
  if (element.dispatchEvent(new MouseEvent('mousedown', init))) {
    const focusable = element.closest<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]');
    if (focusable) focusable.focus(); else (document.activeElement as HTMLElement | null)?.blur();
  }
  element.dispatchEvent(new PointerEvent('pointerup', init));
  element.dispatchEvent(new MouseEvent('mouseup', init));
  element.dispatchEvent(new MouseEvent('click', init));
}

const IMPLICIT_ROLES: Record<string, string> = { BUTTON: 'button', SUMMARY: 'button', A: 'link', SELECT: 'combobox', TEXTAREA: 'textbox', H1: 'heading', H2: 'heading', H3: 'heading', DIALOG: 'dialog' };
const roleOf = (element: Element) => element.getAttribute('role')
  ?? (element instanceof HTMLInputElement ? ({ checkbox: 'checkbox', radio: 'radio', range: 'slider', button: 'button' } as Record<string, string>)[element.type] ?? 'textbox' : IMPLICIT_ROLES[element.tagName] ?? null);
/** The accessible name, as far as the Hub's markup uses it: aria-label, aria-labelledby, a wrapping label, or the text. */
export function accessibleName(element: Element): string {
  const label = element.getAttribute('aria-label');
  if (label) return label.trim();
  const ids = element.getAttribute('aria-labelledby');
  if (ids) return ids.split(/\s+/u).map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
  const wrapping = element.closest('label') ?? (element.id ? document.querySelector(`label[for="${element.id}"]`) : null);
  if (wrapping && wrapping !== element) return wrapping.textContent?.trim() ?? '';
  return element.textContent?.replace(/\s+/gu, ' ').trim() ?? '';
}
/**
 * The elements with this role whose accessible name contains `name` (ignoring case), like
 * Playwright's `getByRole(role, { name })`; `exact` asks for the whole name.
 */
export const byRole = (role: string, name: string, exact = false) =>
  [...document.querySelectorAll<HTMLElement>('*')].filter(element => {
    if (roleOf(element) !== role) return false;
    const accessible = accessibleName(element);
    return exact ? accessible === name : accessible.toLowerCase().includes(name.toLowerCase());
  });

/** Waits, advancing the fake clock, until `check` holds: the specs' `expect(...).toBe...` retry. */
export const until = (check: () => unknown) => vi.waitFor(() => { if (!check()) throw new Error('not yet'); }, { timeout: 5_000, interval: 20 });

/** Types into the focused text field, one key at a time. */
export function type(text: string) { for (const character of text) press(character); }

/** Replaces a field's value as Playwright's `fill` does: focus, the new value, one input event. */
export function fill(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  field.focus(); field.value = value; field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
}
