/**
 * Mounts the Hub fixture page (hub-fixture.ts, the page the Playwright specs drive at `/?hub`)
 * in happy-dom, with the real Hub controller, views, surface controller and command router, so
 * a vitest test can hold DOM and focus rules that need no real browser. Each mount starts from a
 * clean body and the fixture's own query; the previous mount's Hub, window and document
 * listeners and timers are removed first, and Settings starts on Tools as after a page load, so
 * tests never see each other (run the DOM suites with `--sequence.shuffle` to check).
 *
 * `press` sends a key the way Playwright's `keyboard.press` does: modifier key-downs, the key's
 * key-down, the browser's default action when nothing prevented it, then the key-ups. The
 * default actions are the few the Hub's contract reads: typing a character or deleting one in a
 * text field, Enter on a button, a summary or a form field, and Escape closing a modal dialog.
 * The browser's own Tab traversal, caret movement and text selection are not modelled: those
 * cells stay in Playwright. Input is trusted, as Playwright's is, and the fake clock drives
 * timers, `Date` and `performance.now()` alike, so event time stamps and the surface
 * controller's click runs and deadlines read one clock.
 *
 * Focus follows Chromium where the DOM decides it: `focus()` does nothing on an element that is
 * not shown, not focusable, or inert (under `[inert]`, or outside the top dialog opened with
 * `showModal`, which the harness records because happy-dom opens it as a plain `show`), and
 * `click` refuses a detached or inert target, as Playwright's actionability checks do. An element hidden only by the stylesheet still counts as shown: happy-dom loads
 * no CSS, so cells whose answer depends on CSS visibility stay in Playwright.
 */
import { vi } from 'vitest';
import type { EmbeddedSettings } from '../../../shared/hub-settings';

type Added = readonly [EventTarget, string, EventListenerOrEventListenerObject, boolean | AddEventListenerOptions | undefined];
const added: Added[] = [];
let tracking = false;
function track() {
  if (tracking) return;
  tracking = true;
  const targets: EventTarget[] = [window, document, document.documentElement, document.body];
  for (const target of targets) {
    const original = target.addEventListener;
    target.addEventListener = (type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) => {
      if (listener) added.push([target, type, listener, options]);
      original.call(target, type, listener, options);
    };
  }
}
function release() {
  modals.length = 0;
  window.gwHub?.dispose();
  for (const [target, type, listener, options] of added.splice(0)) target.removeEventListener(type, listener, options);
  vi.clearAllTimers();
}

/**
 * Whether an element shows: connected, and no ancestor is hidden, `display: none` inline, a
 * closed dialog, or inside a closed disclosure other than its summary. The stylesheet is not read.
 */
export function shown(element: Element) {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (node.hasAttribute('hidden') || (node instanceof HTMLElement && node.style.display === 'none')) return false;
    if (node instanceof HTMLDialogElement && !node.open) return false;
    const parent: HTMLElement | null = node.parentElement;
    if (parent instanceof HTMLDetailsElement && !parent.open && node !== parent.querySelector(':scope > summary')) return false;
  }
  return element.isConnected;
}

/** Dialogs opened with `showModal`, in opening order: happy-dom's `showModal` is `show`, with no `:modal`. */
const modals: HTMLDialogElement[] = [];
/** The topmost open modal dialog, as Chromium's top layer orders them. */
export const topModal = () => modals.filter(dialog => dialog.open && dialog.isConnected).at(-1) ?? null;
/** Inert as Chromium makes it: under `[inert]`, or outside the topmost modal dialog. */
export function inert(element: Element) {
  if (element.closest('[inert]')) return true;
  const modal = topModal();
  return !!modal && !modal.contains(element);
}

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, iframe, [tabindex], [contenteditable=""], [contenteditable="true"]';
/** Whether `focus()` takes: a focusable, enabled element that shows and is not inert. */
export function focusable(element: HTMLElement) {
  if (!element.matches(FOCUSABLE) || !shown(element) || inert(element)) return false;
  if ('disabled' in element && element.disabled === true) return false;
  return !(element instanceof HTMLInputElement && element.type === 'hidden');
}
let focusGuarded = false;
/** Makes `focus()` refuse what Chromium refuses and records modal dialogs (see the header); once per test file. */
function guardFocus() {
  if (focusGuarded) return;
  focusGuarded = true;
  const focus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) { if (focusable(this)) focus.call(this, options); };
  const showModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    showModal.call(this);
    const index = modals.indexOf(this);
    if (index >= 0) modals.splice(index, 1);
    modals.push(this);
  };
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

/**
 * Mounts a fresh Hub fixture for `?hub<query>` and waits until it is ready, as the specs' `goto`.
 * `stored` is what the page finds in localStorage when it loads (a spec's `addInitScript`).
 */
export async function mountFixture(query = '', stored: Readonly<Record<string, string>> = {}) {
  release();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  history.replaceState(null, '', `/?hub${query}`);
  localStorage.clear();
  for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
  // happy-dom has neither popovers nor pointer lock; the Hub only needs them to exist.
  HTMLElement.prototype.showPopover ??= function () {};
  HTMLElement.prototype.hidePopover ??= function () {};
  if (document.pointerLockElement === undefined) Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
  document.body.replaceChildren();
  if (!fixture) throw new Error('Call loadFixture() in beforeAll first');
  const { mountHubFixture } = fixture;
  track();
  guardFocus();
  const app = document.createElement('div'); app.id = 'app'; document.body.append(app);
  mountHubFixture(app);
  await settle();
  if (app.dataset.ready !== 'true') throw new Error('The Hub fixture did not become ready');
  await startSettingsOnTools();
  return app;
}

/**
 * A page load starts Settings on Tools. The launcher's Settings page remembers its last section
 * in module state, which outlives a fixture mount here, so once the page module has loaded, each
 * mount shows it once at Tools, detached, through its own `mountSettings`.
 */
async function startSettingsOnTools() {
  if (!document.head.querySelector('link[data-gwonmac-settings-stylesheet]')) return;
  // The Hub's own specifier; vite.config.ts resolves it to the launcher's Settings entry.
  const specifier = './settings/settings-app.js';
  const settings: EmbeddedSettings<HTMLElement> = await import(/* @vite-ignore */ specifier);
  const host = document.createElement('div');
  const page = settings.mountSettings(host, {
    api: window.gwNative.hubSettings, target: { section: 'tools' }, extendedMemory: async () => null,
    openInLauncher: () => undefined, mayTakeFocus: () => false,
  });
  await until(() => host.querySelector('.settings-page'));
  page.dispose();
}
export const unmountFixture = () => { release(); vi.useRealTimers(); };

/** Marks an event as the browser's own, as Playwright's input is: the surface controller reads only trusted presses. */
function trusted<T extends Event>(event: T): T {
  Object.defineProperty(event, 'isTrusted', { value: true });
  return event;
}
const MODIFIERS = { Meta: 'metaKey', Control: 'ctrlKey', Alt: 'altKey', Shift: 'shiftKey' } as const;
type Modifier = keyof typeof MODIFIERS;
const isModifier = (part: string): part is Modifier => Object.hasOwn(MODIFIERS, part);
const modifier = (part: string): Modifier => { if (isModifier(part)) return part; throw new Error(`Not a modifier: ${part}`); };
const CODES: Record<string, string> = { Enter: 'Enter', Escape: 'Escape', Backspace: 'Backspace', Tab: 'Tab', ArrowDown: 'ArrowDown', ArrowUp: 'ArrowUp', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', Home: 'Home', End: 'End', PageDown: 'PageDown', PageUp: 'PageUp', Meta: 'MetaLeft', Control: 'ControlLeft', Alt: 'AltLeft', Shift: 'ShiftLeft', ' ': 'Space' };
const code = (key: string) => CODES[key] ?? (/^[a-z]$/iu.test(key) ? `Key${key.toUpperCase()}` : /^[0-9]$/u.test(key) ? `Digit${key}` : key);
const target = () => document.activeElement ?? document.body;
const textField = (element: Element): element is HTMLInputElement | HTMLTextAreaElement =>
  element instanceof HTMLTextAreaElement || (element instanceof HTMLInputElement && ['text', 'search', 'url', 'email', 'tel', 'password', ''].includes(element.type));

function send(type: 'keydown' | 'keyup', key: string, held: ReadonlySet<Modifier>, repeat = false) {
  const init: KeyboardEventInit = { key, code: code(key), bubbles: true, cancelable: true, composed: true, repeat };
  for (const modifier of held) init[MODIFIERS[modifier]] = true;
  return target().dispatchEvent(trusted(new KeyboardEvent(type, init)));
}

/** The browser's default action for an unprevented key-down, for the keys the Hub's contract reads. */
function defaultAction(key: string, held: ReadonlySet<Modifier>) {
  const element = target();
  const plain = held.size === 0 || (held.size === 1 && held.has('Shift'));
  if (key.length === 1 && plain && textField(element)) {
    element.value += key; element.dispatchEvent(trusted(new InputEvent('input', { bubbles: true, data: key, inputType: 'insertText' }))); return;
  }
  if (key === 'Backspace' && held.size === 0 && textField(element) && element.value) {
    element.value = element.value.slice(0, -1); element.dispatchEvent(trusted(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))); return;
  }
  if (key === 'Enter' && held.size === 0) {
    if (element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement || (element instanceof HTMLElement && element.tagName === 'SUMMARY')) { element.click(); return; }
    if (element instanceof HTMLInputElement && element.form) { element.form.requestSubmit(); return; }
  }
  if (key === 'Escape') {
    const dialog = topModal();
    if (dialog && dialog.dispatchEvent(trusted(new Event('cancel', { cancelable: true })))) dialog.close();
  }
}

/** Presses a chord such as `Meta+Backspace` as Playwright's `keyboard.press` does. */
export function press(chord: string) {
  const parts = chord.split('+');
  const key = parts.pop()!;
  const modifiers = parts.map(modifier);
  const held = new Set<Modifier>();
  for (const modifier of modifiers) { held.add(modifier); send('keydown', modifier, held); }
  if (send('keydown', key, held)) defaultAction(key, held);
  send('keyup', key, held);
  for (const modifier of [...modifiers].reverse()) { held.delete(modifier); send('keyup', modifier, held); }
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
/**
 * Where a click lands. Playwright clicks an element's center; happy-dom has no layout, so each
 * element gets its own point, 60 px from any other, and the same element always the same point:
 * presses on two elements never join one click run, and a double-click on one element does.
 */
const points = new WeakMap<Element, Readonly<{ clientX: number; clientY: number }>>();
let placed = 0;
function pointOf(element: Element) {
  let point = points.get(element);
  if (!point) { point = { clientX: 30 + (placed % 16) * 60, clientY: 30 + Math.floor(placed / 16) * 60 }; placed++; points.set(element, point); }
  return point;
}
export function click(element: Element, detail = 1) {
  // Playwright clicks an attached element that receives pointer events; a detached or inert one never does.
  if (!element.isConnected) throw new Error(`Detached, so Playwright could not click it: ${element.tagName} "${accessibleName(element)}"`);
  if (inert(element)) throw new Error(`Inert, so Playwright could not click it: ${element.tagName} "${accessibleName(element)}" (${element.closest('[inert]') ? 'under [inert]' : `outside the modal #${topModal()?.id}`})`);
  const init = { bubbles: true, cancelable: true, composed: true, detail, button: 0, ...pointOf(element) };
  element.dispatchEvent(trusted(new PointerEvent('pointerdown', init)));
  if (element.dispatchEvent(trusted(new MouseEvent('mousedown', init)))) {
    const focusable = element.closest<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]');
    if (focusable) focusable.focus(); else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  element.dispatchEvent(trusted(new PointerEvent('pointerup', init)));
  element.dispatchEvent(trusted(new MouseEvent('mouseup', init)));
  element.dispatchEvent(trusted(new MouseEvent('click', init)));
}

const INPUT_ROLES: Record<string, string> = { checkbox: 'checkbox', radio: 'radio', range: 'slider', button: 'button' };
const IMPLICIT_ROLES: Record<string, string> = { BUTTON: 'button', SUMMARY: 'button', A: 'link', SELECT: 'combobox', TEXTAREA: 'textbox', H1: 'heading', H2: 'heading', H3: 'heading', DIALOG: 'dialog' };
const roleOf = (element: Element) => element.getAttribute('role')
  ?? (element instanceof HTMLInputElement ? INPUT_ROLES[element.type] ?? 'textbox' : IMPLICIT_ROLES[element.tagName] ?? null);
/** The accessible name, as far as the Hub's markup uses it: aria-label, aria-labelledby, a wrapping label, or the text. */
export function accessibleName(element: Element): string {
  const label = element.getAttribute('aria-label');
  if (label) return label.trim();
  const ids = element.getAttribute('aria-labelledby');
  if (ids) return ids.split(/\s+/u).map(id => document.getElementById(id)?.textContent?.trim() ?? '').join(' ').trim();
  const wrapping = element.closest('label') ?? (element.id ? document.querySelector(`label[for="${element.id}"]`) : null);
  if (wrapping && wrapping !== element) return visibleText(wrapping);
  return visibleText(element);
}
/** Text a screen reader reads from content: aria-hidden parts (key caps, icons) left out. */
function visibleText(element: Element): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node instanceof Element && node.getAttribute('aria-hidden') === 'true') return;
    if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent ?? '');
    node.childNodes.forEach(walk);
  };
  walk(element);
  return parts.join('').replace(/\s+/gu, ' ').trim();
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

/** The element as the class a test expects, or a thrown error that names what was found. */
export function narrow<T extends Element>(type: abstract new (...args: never[]) => T, element: Element | null | undefined): T {
  if (!(element instanceof type)) throw new Error(`Expected ${type.name}, found ${element ? element.tagName : String(element)}`);
  return element;
}

/** Waits, advancing the fake clock, until `check` holds: the specs' `expect(...).toBe...` retry. */
export const until = (check: () => unknown) => vi.waitFor(() => { if (!check()) throw new Error('not yet'); }, { timeout: 5_000, interval: 20 });

/** Types into the focused text field, one key at a time. */
export function type(text: string) { for (const character of text) press(character); }

/** Replaces a field's value as Playwright's `fill` does: focus, the new value, one input event. */
export function fill(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  field.focus(); field.value = value; field.dispatchEvent(trusted(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value })));
}
