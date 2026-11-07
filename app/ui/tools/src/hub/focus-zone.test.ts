/** The Hub focus zone: arrows stay inside a zone and stop at its ends; a lost control hands the keyboard on. */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import { useFocusZone, type FocusZoneOrientation } from './focus-zone';

let app: App | null = null;
let host: HTMLElement;
const state = ref({ disabled: false, shown: true, generation: 0 });

beforeEach(() => {
  state.value = { disabled: false, shown: true, generation: 0 };
  host = document.createElement('div');
  document.body.append(host);
  // happy-dom draws no boxes; a connected, unhidden control counts as shown, as in the real Hub.
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
    return (this.isConnected && !this.closest('[hidden]') ? [new DOMRect(0, 0, 10, 10)] : []) as unknown as DOMRectList;
  });
});
afterEach(() => { app?.unmount(); app = null; host.remove(); vi.restoreAllMocks(); });

/** A zone of three buttons and an outside fallback; `b` can be disabled or redrawn, `c` removed. */
function mount(orientation: FocusZoneOrientation) {
  app = createApp({
    setup() {
      const zone = ref<HTMLElement>();
      const fallback = ref<HTMLElement>();
      useFocusZone(zone, { orientation, fallback: () => fallback.value ?? null });
      return () => h('div', [
        h('div', { ref: zone, class: 'zone' }, [
          h('button', { 'data-focus-key': 'a' }, 'A'),
          h('button', { 'data-focus-key': 'b', disabled: state.value.disabled, key: `b${state.value.generation}` }, 'B'),
          state.value.shown ? h('button', { 'data-focus-key': 'c' }, 'C') : null,
        ]),
        h('button', { ref: fallback, 'data-focus-key': 'fallback' }, 'Fallback'),
      ]);
    },
  });
  app.mount(host);
  const button = (key: string) => host.querySelector<HTMLButtonElement>(`[data-focus-key="${key}"]`)!;
  const press = (key: string) => (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  const focused = () => (document.activeElement as HTMLElement | null)?.dataset.focusKey;
  return { button, press, focused };
}

test.each([
  ['horizontal', 'ArrowRight', 'ArrowLeft'],
  ['list', 'ArrowDown', 'ArrowUp'],
] as const)('a %s zone moves inside itself and stops at both ends', (orientation, forward, backward) => {
  const { button, press, focused } = mount(orientation);
  button('a').focus();
  const seen = [forward, forward, forward, backward, backward, backward].map(key => { press(key); return focused(); });
  expect(seen).toEqual(['b', 'c', 'c', 'b', 'a', 'a']);
});

test('a list zone takes End and Home', () => {
  const { button, press, focused } = mount('list');
  button('a').focus();
  press('End'); expect(focused()).toBe('c');
  press('Home'); expect(focused()).toBe('a');
});

test('a focused control that turns disabled hands the keyboard to the fallback, never <body>', async () => {
  const { button, focused } = mount('horizontal');
  button('b').focus();
  state.value = { ...state.value, disabled: true };
  await nextTick();
  expect(focused()).toBe('fallback');
});

test('a focused control that is removed hands the keyboard to the fallback', async () => {
  const { button, focused } = mount('horizontal');
  button('c').focus();
  state.value = { ...state.value, shown: false };
  await nextTick();
  expect(focused()).toBe('fallback');
});

test('a focused control drawn again keeps the keyboard on its new element', async () => {
  const { button, focused } = mount('horizontal');
  const before = button('b');
  before.focus();
  state.value = { ...state.value, generation: 1 };
  await nextTick();
  expect(button('b')).not.toBe(before);
  expect([focused(), document.activeElement === button('b')]).toEqual(['b', true]);
});
