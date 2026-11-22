/**
 * Every feature's game-host part, started and stopped, leaves nothing behind (plan step 4.2): no
 * timer, interval or animation frame, no listener on a live target, no observer, no DOM node, no
 * Hub source and no bridge or play-region subscription. A leak that survives Stop keeps working
 * after the player turned the feature off, and only a long session shows it.
 *
 * The parts run through their real entry points: the Tools installer for every companion part,
 * on the real Hub with its real view, in happy-dom. Only the boundaries are stubbed:
 * ArenaNet's module (every export answers 1), the preload bridge, the kernel's dispatch, and the
 * built Tools bundle: its Vue apps read the whole bridge and have their own component tests, so a
 * stand-in records each app a part mounts and whether the part disposes it.
 * The main-process parts have their own test (tests/unit/feature-main-parts-stop-leaves-nothing.test.ts).
 */
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
// eslint-disable-next-line no-restricted-imports
import type {} from '../../../renderer/gw-native';
// eslint-disable-next-line no-restricted-imports
import { createHub } from '../../../renderer/hub';
// eslint-disable-next-line no-restricted-imports
import { withHubBuiltins } from '../../../renderer/hub-builtins';
// eslint-disable-next-line no-restricted-imports
import { prepareToolsCompanionExtension } from '../../../renderer/certified-companion-tools-installation';
// eslint-disable-next-line no-restricted-imports
import { installSurfaceController } from '../../../renderer/surface-controller';
import { RELEASE_ENHANCEMENT_CAPABILITIES } from '../../../shared/enhancement-contracts';
import { FEATURES, FEATURE_SELECTION_POLICIES } from '../../../shared/feature-contracts';
import { TOOL_COMMANDS } from '../../../shared/hub-tools';
// eslint-disable-next-line no-restricted-imports
import { toggleTool } from '../../../renderer/feature-links';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../shared/settings/index';
import { installLeakLedger, type Leak, type LeakLedger } from '../../../../tests/helpers/leak-ledger';
import { fixtureFacts } from './fixture-facts';
// eslint-disable-next-line no-restricted-imports
import characterSwitchHub from '../../../features/character-switch/renderer/host';
// eslint-disable-next-line no-restricted-imports
import { installCartographyHost } from '../../../features/cartography/renderer/host';
import { mountHubView } from './hub/embedded';

/**
 * The Tools bundle the game host loads (`tools/tools-app.js`, src/embedded.ts in this test). Its
 * five mounts are stood in where embedded.ts imports them: vitest swaps static imports reliably,
 * but not the host's dynamic import with a variable specifier. Each mount holds an app until its
 * handle's `dispose`. Nothing else is modelled.
 */
const { mounted } = vi.hoisted(() => ({
  mounted(what: string) {
    const token = {};
    ledger.take(token, 'Tools bundle app', what);
    const members: Record<string, unknown> = {
      dispose: () => ledger.give(token),
      stepBack: () => false,
      active: false,
      source: { search: () => [], setVisible() {}, subscribe: () => () => {} },
      // Travel's Hub page: one node, removed by the page's own unmount.
      page: () => (target: HTMLElement) => {
        const node = target.ownerDocument.createElement('section');
        node.className = 'travel-page';
        target.append(node);
        return () => node.remove();
      },
    };
    return new Proxy(members, { get: (target, key) => typeof key === 'symbol' || key === 'then' ? undefined : key in target ? target[key] : () => undefined });
  },
}));
vi.mock('./elite-mount', () => ({ mountEliteSkills: () => mounted('mountEliteSkills') }));
vi.mock('./whispers-mount', () => ({ mountWhispers: () => mounted('mountWhispers') }));
vi.mock('./mount', () => ({ mountToolsApp: () => mounted('mountToolsApp') }));
vi.mock('./hub-travel', () => ({ createHubTravel: () => mounted('createHubTravel') }));
vi.mock('./trade-mount', () => ({ mountTradeChat: () => mounted('mountTradeChat') }));

/** Every feature's switch on, so every part starts what it shows. */
const ALL_ON: Record<string, boolean> = {};
for (const { id } of FEATURES) {
  const own = FEATURE_SELECTION_POLICIES[id].switch;
  if (own !== null) ALL_ON[own] = true;
}
let settings: AppSettings = { ...DEFAULT_SETTINGS, ...ALL_ON };
const changeSettings = (patch: Partial<AppSettings>) => {
  settings = { ...settings, ...patch };
  window.dispatchEvent(new Event('gw:tools-settings'));
};

let ledger: LeakLedger;

/** Fixed values the parts read from the bridge; every other member is a call that resolves to nothing. */
const BRIDGE_VALUES: Readonly<Record<string, unknown>> = {
  'init.development': false,
  'init.enhancementSelection': { nativeCursor: true, tools: true },
  // The Tools app mounts once both resolve; a session without a compatibility report is still checking.
  'client.session': () => Promise.resolve({ appVersion: 'test', compatibility: null, healthToken: null }),
};
function bridge(path: string): unknown {
  const call = () => {
    if (!/(^|\.)(on[A-Z]\w*|subscribe)$/u.test(path)) return Promise.resolve(undefined);
    const unsubscribe = () => ledger.give(unsubscribe);
    ledger.take(unsubscribe, 'bridge subscription', `gwNative.${path}`);
    return unsubscribe;
  };
  return new Proxy(call, {
    get(_target, key) {
      if (typeof key === 'symbol' || key === 'then') return undefined;
      const next = path === '' ? key : `${path}.${key}`;
      return Object.hasOwn(BRIDGE_VALUES, next) ? BRIDGE_VALUES[next] : bridge(next);
    },
    // A Tools launch: the bridge has the Tools members too.
    has: () => true,
  });
}

const describe = (target: EventTarget) => target === window ? 'window' : target === document ? 'document'
  : target instanceof Element ? `<${target.tagName.toLowerCase()}${target.id ? `#${target.id}` : ''}>` : target.constructor.name;

beforeAll(async () => {
  // The game host loads the Tools bundle with a dynamic import. Loaded here first, it resolves from the
  // module cache within one settle, so each app mounts inside the test whose part asked for it.
  await import('./embedded');
  // happy-dom has no popover methods or pointer lock; the Hub only needs them to exist.
  HTMLElement.prototype.showPopover ??= function () {};
  HTMLElement.prototype.hidePopover ??= function () {};
  if (document.pointerLockElement === undefined) Object.defineProperty(document, 'pointerLockElement', { configurable: true, value: null });
  ledger = installLeakLedger({
    timers: window === globalThis ? [globalThis] : [globalThis, window],
    animationFrames: window === globalThis ? [globalThis] : [globalThis, window],
    eventTargets: [window, document, document.createElement('div'), new window.EventTarget()],
    observers: { owners: [window], names: ['MutationObserver', 'ResizeObserver', 'IntersectionObserver'] },
    // A listener on a node that left the page cannot fire again.
    reachable: (target) => !(target instanceof Node) || target === document || target.isConnected,
    describe,
  });
  document.body.replaceChildren();
  const canvas = document.createElement('canvas');
  canvas.id = 'canvas';
  document.body.append(canvas);
  Object.assign(window, {
    gwNative: bridge(''),
    gwToolsSettings: () => settings,
    gwFeatureFacts: () => fixtureFacts(settings),
    gwSurfaces: installSurfaceController(document, { doubleClickMs: 400 }),
  });
  // The Hub is Core: the game host installs it before any feature starts.
  const hub = withHubBuiltins(createHub(document.body, { mountHubView }));
  // A source a part attaches and never detaches keeps answering searches after Stop.
  const attach = hub.attach;
  hub.attach = (source) => {
    const detach = attach(source);
    const tracked = () => { ledger.give(tracked); detach(); };
    ledger.take(tracked, 'Hub source', source.feature ?? 'a source');
    return tracked;
  };
  window.gwHub = hub;
  // The Hub paints its closed panel once a source comes or goes; paint it now so the baseline has it.
  hub.attach({ search: () => [], setVisible() {}, subscribe: () => () => {} })();
});
afterAll(() => ledger.uninstall());

/** Lets pending frames and timeouts run: the Hub repaints a frame after a source comes or goes. */
const settle = async () => { for (let round = 0; round < 3; round += 1) await new Promise(resolve => setTimeout(resolve, 20)); };

const tagOf = (node: Element) => `<${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ''}${node.classList[0] ? `.${node.classList[0]}` : ''}>`;

/**
 * Leftovers found by this test and listed for Phase 5 instead of fixed here
 * (docs/feature-platform-plan.md, step 4.2). Each must still occur somewhere in this file, so the
 * list shrinks when one is fixed.
 */
const KNOWN_LEFTOVERS: readonly Readonly<{ leftover: string; why: string }>[] = [
  { leftover: 'DOM node: <link> in <head>',
    why: 'ensureToolsStylesheet (app/renderer/tools-stylesheet.ts) adds the Tools stylesheet once per page and nothing removes it' },
  { leftover: 'DOM node: <section.travel-page> in <div.hub-view>',
    why: 'a feature page (Travel) stays mounted in a closed Hub after its part stops: the Hub engine withdraws a dead page only while the Hub is open (app/renderer/hub-engine.ts, withdraw)' },
];
const seenLeftovers = new Set<string>();
const HUB_PAGE_STATE = /^DOM node: .* in <(div#hub-results|span\.hub-legend|button\.hub-primary|button\.hub-actions)/u;
afterAll(() => {
  expect(KNOWN_LEFTOVERS.map(({ leftover }) => leftover).filter(leftover => !seenLeftovers.has(leftover))).toEqual([]);
});

/** The page and every resource before a part starts; `leftOver` lists what is new after it stopped and the page settled. */
async function baseline() {
  await settle();
  const page = document.documentElement.outerHTML;
  const nodes = new Set(document.querySelectorAll('*'));
  const mark = ledger.mark();
  return {
    /** Everything left, known leftovers included. */
    async everything(): Promise<string[]> {
      await settle();
      const leaks = ledger.since(mark).map(({ kind, what, where }: Leak) => `${kind}: ${what}${where ? ` (${where})` : ''}`);
      if (document.documentElement.outerHTML !== page) {
        for (const node of document.querySelectorAll('*')) {
          if (!nodes.has(node) && (node.parentElement === null || nodes.has(node.parentElement))) {
            leaks.push(`DOM node: ${tagOf(node)} in ${node.parentElement ? tagOf(node.parentElement) : 'nothing'}`);
          }
        }
      }
      return leaks;
    },
    /** What is left besides the known leftovers and the Hub's own drawing of a page it still stands on. */
    async leftOver(): Promise<string[]> {
      const leaks = await this.everything();
      const pageLeft = leaks.some(leak => KNOWN_LEFTOVERS[1]!.leftover === leak);
      return leaks.filter(leak => {
        const known = KNOWN_LEFTOVERS.find(({ leftover }) => leftover === leak);
        if (known) seenLeftovers.add(known.leftover);
        return !known && !(pageLeft && HUB_PAGE_STATE.test(leak));
      });
    },
  };
}

/** ArenaNet's side of a Tools launch: every export answers 1, and the module carries no manifest. */
function officialClient() {
  const memory = new WebAssembly.Memory({ initial: 512 });
  let heap = 1 << 16;
  const malloc = (bytes: number) => { const pointer = heap; heap += (bytes + 15) & ~15; return pointer; };
  const exports: WebAssembly.Exports = new Proxy({ memory, malloc, free: () => {} } as Record<string, WebAssembly.ExportValue>, {
    get: (target, key) => typeof key !== 'string' ? undefined : key in target ? target[key] : () => 1,
    has: () => true,
  });
  // Without a friend observer or Maps manifest, the friend feed stays off and Maps cannot install.
  const module = new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
  return { memory, malloc, exports, module };
}

/** Starts every game part the way Core does (certified-companion-core-installation.ts) and returns Core's Stop. */
async function startGameParts(): Promise<() => void> {
  const { memory, malloc, exports, module } = officialClient();
  const free = () => {};
  const capabilities = RELEASE_ENHANCEMENT_CAPABILITIES.tools;
  const extension = await prepareToolsCompanionExtension(exports, module, capabilities, 'none');
  extension.allocate(malloc);
  extension.initialize(memory);
  const region = () => ({ pointer: malloc(4096), bytes: 4096 });
  const core = { snapshot: region(), toolbox: region(), party: region(), cursor: region(), characterList: region() };
  const state = Object.freeze({ status: 'ready', sequence: 2, mapId: 248, instanceType: 1, playRegion: 'pve',
    travelContext: 'world', characterKey: '0000000100000002', unlockedMapWords: null, guildHall: false, hasGuildHall: false });
  const playRegions = {
    pointer: malloc(64), state, setActive() {},
    subscribe(listener: (next: typeof state) => void) {
      const unsubscribe = () => ledger.give(unsubscribe);
      ledger.take(unsubscribe, 'play-region subscription', 'playRegions.subscribe');
      listener(state);
      return unsubscribe;
    },
  };
  const session = extension.activate({
    memory, exports, capabilities, program: 'none',
    core: core as never, kernel: { dispatch: () => 0 } as never, playRegions: playRegions as never,
    isCleaned: () => false, hookInstalled: () => true, setHookEnabled() {},
  });
  session.beforeHook();
  session.afterHook();
  return () => {
    session.withdrawPolicy();
    session.disposePresentation();
    session.releaseObserverMemory(free);
    session.releaseCallbackResources(free);
  };
}

/** What a player can open: every feature tool's shortcut event or link toggle (app/features/<id>/feature.ts). */
const TOOL_EVENTS = FEATURES.flatMap(feature => 'tool' in feature && 'event' in feature.tool ? [feature.tool.event] : []);
// Whispers last: it opens over the Hub and suspends it, so the Hub pages opened before it (Travel)
// stay mounted under it, as after a player's last shortcut.
const TOOL_LINKS = [...TOOL_COMMANDS.values()].flatMap(opener => 'link' in opener ? [opener.link] : [])
  .sort((a, b) => Number(a === 'whispers') - Number(b === 'whispers'));
const openEverything = async () => {
  for (const type of TOOL_EVENTS) window.dispatchEvent(new CustomEvent(type, { cancelable: true, detail: { show: true } }));
  for (const target of TOOL_LINKS) toggleTool(target, 'show');
  await settle();
};

test('every game part stops without leaving anything, with every feature on and its surfaces open', async () => {
  settings = { ...DEFAULT_SETTINGS, ...ALL_ON };
  const page = await baseline();
  const stop = await startGameParts();
  changeSettings({ whispersEnabled: false });
  changeSettings({ whispersEnabled: true });
  await openEverything();
  stop();
  expect(await page.leftOver()).toEqual([]);
});

test('every game part stops without leaving anything after its feature was switched off', async () => {
  settings = { ...DEFAULT_SETTINGS, ...ALL_ON };
  const page = await baseline();
  const stop = await startGameParts();
  await openEverything();
  changeSettings(Object.fromEntries(Object.keys(ALL_ON).map(key => [key, false])));
  await settle();
  stop();
  expect(await page.leftOver()).toEqual([]);
});

test('Character Switch\'s host stops without leaving anything, after its page opened', async () => {
  settings = { ...DEFAULT_SETTINGS, ...ALL_ON };
  const page = await baseline();
  const host = characterSwitchHub.start({ parent: document.body, hub: window.gwHub ?? null });
  window.dispatchEvent(new CustomEvent('gw:character-toggle', { cancelable: true }));
  await settle();
  host.stop();
  expect(await page.leftOver()).toEqual([]);
});

test('Maps\' host stops without leaving anything', async () => {
  settings = { ...DEFAULT_SETTINGS, ...ALL_ON };
  const page = await baseline();
  const { exports, module } = officialClient();
  const failures: unknown[] = [];
  const host = installCartographyHost({
    exports, module, parent: document.body, canvas: document.querySelector('canvas')!,
    api: window.gwNative as never, settings: () => settings, reportFailure: failure => failures.push(failure),
  });
  host.update();
  await settle();
  host.dispose();
  expect(await page.leftOver()).toEqual([]);
});

test('the check catches a planted leak of every kind', async () => {
  const page = await baseline();
  const stop = await startGameParts();
  // A part that forgets each of these in its Stop.
  window.addEventListener('keydown', () => {});
  const interval = setInterval(() => {}, 1000);
  setTimeout(() => {}, 60_000);
  let looping = true;
  const loop = () => { if (looping) requestAnimationFrame(loop); };
  loop();
  new MutationObserver(() => {}).observe(document.body, { childList: true });
  document.body.append(document.createElement('aside'));
  window.gwHub!.attach({ search: () => [], setVisible() {}, subscribe: () => () => {} });
  (window.gwNative.settings as unknown as { onChanged(listener: () => void): () => void }).onChanged(() => {});
  const { mountTradeChat } = await import('./trade-mount');
  const app = mountTradeChat(document.body, {} as Parameters<typeof mountTradeChat>[1]);
  stop();
  const leaks = await page.leftOver();
  clearInterval(interval);
  looping = false;
  expect(leaks.map(leak => leak.replace(/ \(.*\)$/u, '')).sort()).toEqual([
    'DOM node: <aside> in <body>',
    'Hub source: a source',
    'Tools bundle app: mountTradeChat',
    'animation frame: requestAnimationFrame',
    'bridge subscription: gwNative.settings.onChanged',
    'interval: setInterval 1000 ms',
    'listener: window keydown',
    'observer: MutationObserver',
    'timer: setTimeout 60000 ms',
  ]);
  for (const node of document.querySelectorAll('aside')) node.remove();
  app.dispose();
});
