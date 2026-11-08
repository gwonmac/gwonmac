/**
 * The pointer contract of the Hub (HUB-242, HUB-244, HUB-248, D-24) with the real fixture, Hub
 * controller and surface controller in happy-dom. Every click run is built as a person makes
 * one: presses at one point with click count 1, 2, 3 and a time gap (event.timeStamp, which the
 * surface controller reads). A row that changes the game or the account selects on a click and
 * runs only on the footer primary or its own double-click; a navigational row opens at once and
 * the rest of its run dies with the page it began on; trailing presses of a run that closed the
 * Hub never reach the game canvas. Where the pointer lands after a layout change, hover under a
 * resting pointer and scrolling stay in hub-pointer.spec.ts.
 */
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { byRole, click, fill, loadFixture, mountFixture, narrow, press, settle, type, unmountFixture, until } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

// The Hub reads no time of its own: the gap between presses only matters to the surface controller, whose gap
// table is in surface-click-runs.test.ts. Here one human gap shows how each row source answers a click run.
const GAP = 120;
const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const caption = () => document.querySelector('.hub-caption')!.textContent;
const primary = () => document.querySelector<HTMLElement>('.hub-primary')!;
const crumbs = () => document.querySelectorAll('.hub-crumb').length;
const row = (text: string | RegExp) => [...document.querySelectorAll<HTMLElement>('#hub .hub-row')].find(candidate => (typeof text === 'string' ? candidate.textContent!.includes(text) : text.test(candidate.textContent!)))!;
const byId = (id: string) => document.querySelector<HTMLElement>(`#hub .hub-row[data-id="${id}"]`)!;
const ledger = () => [...(window.gwFixtureActions ?? [])];
const canvas = () => (window.gwFixtureCanvas?.events ?? []).filter(event => event.type !== 'keyup' || event.code).map(event => `${event.type}:${event.code ?? event.detail}`);
const gameCanvas = () => document.getElementById('canvas')!;
const hubOpen = () => (narrow(HTMLDialogElement, document.getElementById('hub'))).open;
async function enter(query: string) { fill(search(), query); await settle(); press('Enter'); await settle(); }

/** The click clock: a run's presses carry the time of the fake clock, as Chromium stamps them. */
let stamp = 1_000;
const HERE = { x: 100, y: 100 };
function dispatchPress(target: Element, detail: number, at = HERE) {
  const init = { bubbles: true, cancelable: true, composed: true, detail, button: 0, clientX: at.x, clientY: at.y };
  const send = (event: Event) => { Object.defineProperty(event, 'isTrusted', { value: true }); Object.defineProperty(event, 'timeStamp', { value: stamp }); return target.dispatchEvent(event); };
  send(new PointerEvent('pointerdown', { ...init, detail: 0 }));
  if (send(new MouseEvent('mousedown', init))) {
    const focusable = target.closest<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex]');
    if (focusable) focusable.focus(); else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
  send(new PointerEvent('pointerup', { ...init, detail: 0 }));
  send(new MouseEvent('mouseup', init));
  send(new MouseEvent('click', init));
  if (detail === 2) send(new MouseEvent('dblclick', init));
}
/**
 * Presses one element `count` times with the click counts macOS reports; a gap of ms between
 * presses. The pointer stays at one point: when a press replaced the page, the next press lands
 * on what the new page shows there, the first row (or the Hub itself), as the real pointer does;
 * `lands` names what the pointer is over then when the test knows it, and answers undefined
 * when the press stays on the target.
 */
async function clicks(target: Element, count: number, gap = 120, lands?: () => Element | undefined, after?: (clickCount: number) => void) {
  stamp += 1_000;
  for (let clickCount = 1; clickCount <= count; clickCount++) {
    dispatchPress(clickCount === 1 ? target : lands?.() ?? (target.isConnected ? target : document.querySelector('#hub .hub-row') ?? document.querySelector('#hub')!), clickCount);
    after?.(clickCount);
    if (clickCount < count) { stamp += gap + 40; await vi.advanceTimersByTimeAsync(gap + 40); }
  }
  await vi.advanceTimersByTimeAsync(800);
}

/** Rows whose primary changes the game or the account (D-24), opened on their own page. */
const consequential: Record<string, { query?: string; open(): Promise<HTMLElement> | HTMLElement; footer: RegExp; ran: string[] }> = {
  'Continue Eye of the North': { open: () => row('Eye of the North'), footer: /^Travel to Eye of the North/, ran: ['TRAVEL Eye of the North'] },
  'Apply to me': { open: async () => { await enter('build smiter'); return byRole('option', 'Apply to me')[0]!; }, footer: /^Apply Smiter to Fixture Monk/, ran: ['apply-build', 'command:1', 'command:2'] },
  'Open Second': { open: async () => { await enter('acc s'); return document.querySelector<HTMLElement>('.hub-row[data-id$=":open"]')!; }, footer: /^Open Second/, ran: ['Account Second open'] },
  'Close Main and open Second': { open: async () => { await enter('acc s'); return row('Close Main and open Second'); }, footer: /^Close Main and open Second/, ran: [] },
  'character card': { open: async () => { press('Meta+e'); await settle(); return document.querySelector<HTMLElement>('button[data-character-key="mesmer"]')!; }, footer: /^Switch to Fixture Mesmer/, ran: ['Character mesmer'] },
  'Invite to party': { query: '&party', open: async () => { await enter('zed delta'); await until(() => caption() === 'Zed Delta'); return row('Invite to party'); }, footer: /^Invite Zed Delta/, ran: ['PARTY.INVITE Zed Delta'] },
};

describe('a row that changes the game', () => {
  for (const [name, subject] of Object.entries(consequential)) {
    test(`${name}: a click selects and names the primary and runs nothing; its double-click runs it exactly once`, async () => {
      await mountFixture(subject.query);
      const target = await subject.open();
      await vi.advanceTimersByTimeAsync(600);
      await clicks(target, 2, GAP, undefined, clickCount => {
        if (clickCount > 1) return;
        expect(target.getAttribute('aria-selected')).toBe('true');
        expect(document.querySelector('#hub .hub-primary')!.textContent).toMatch(subject.footer);
        expect(ledger()).toEqual([]);
        expect(hubOpen()).toBe(true);
      });
      // Replacing the running game passes an armed confirmation first.
      if (name === 'Close Main and open Second') expect(caption()).toBe('Close Main?');
      await until(() => ledger().length >= subject.ran.length);
      expect(ledger()).toEqual(subject.ran);
      expect(canvas()).toEqual([]);
    });
  }

  test('a triple-click on Apply to me applies once and nothing runs after it', async () => {
    await mountFixture();
    await enter('build smiter');
    await clicks(byRole('option', 'Apply to me')[0]!, 3);
    expect(ledger()).toEqual(['apply-build', 'command:1', 'command:2']);
    expect(canvas().filter(event => !/:(0|1)$/u.test(event))).toEqual([]);
  });

  test('a double-click whose second press lands on another row runs nothing', async () => {
    await mountFixture();
    await clicks(row('Kamadan'), 1, 0);
    stamp += 100;
    dispatchPress(row('Kaineng Center'), 2);
    await vi.advanceTimersByTimeAsync(600);
    expect(ledger()).toEqual([]);
    expect(hubOpen()).toBe(true);
    const selected = document.querySelector('.hub-row[aria-selected="true"] .hub-title')!.textContent!;
    expect(primary().textContent).toContain(selected.split(',')[0]!);
  });
});

describe('a navigational row', () => {
  const fillSettled = async (query: string) => { fill(search(), query); await settle(); };
  const navigational: Record<string, { query?: string; open(): Promise<HTMLElement> | HTMLElement; lands: string }> = {
    'Build Library': { open: () => row('Build Library'), lands: 'Build Library' },
    'Settings': { open: () => byId('settings'), lands: 'Settings' },
    'Commands': { open: () => byId('commands'), lands: 'Commands' },
    'Travel': { open: () => byId('travel'), lands: 'Travel' },
    'Smiter': { open: async () => { await fillSettled('build mo'); return row('Smiter'); }, lands: 'Smiter' },
    'Second': { open: async () => { await fillSettled('acc s'); return row('Second'); }, lands: 'Second' },
    'Zed Beta': { query: '&party', open: async () => { await fillSettled('zed'); return row('Zed Beta'); }, lands: 'Zed Beta' },
    'Switch Character': { open: async () => { await fillSettled('char'); return row('Switch Character'); }, lands: 'Characters' },
    'Apply to hero': { open: async () => { await enter('build smiter'); return row('Apply to hero'); }, lands: 'Heroes' },
  };
  for (const [name, subject] of Object.entries(navigational)) {
    test(`${name}: a click opens one level at once, and the rest of a double-click opens nothing more`, async () => {
      await mountFixture(subject.query);
      const target = await subject.open();
      const before = crumbs();
      await clicks(target, 2, GAP, undefined, clickCount => {
        if (clickCount > 1) return;
        expect(caption()).toBe(subject.lands);
        expect(crumbs()).toBe(before + 1);
      });
      await settle();
      expect(caption()).toBe(subject.lands);
      expect(crumbs()).toBe(before + 1);
      expect(ledger()).toEqual([]);
      expect(hubOpen()).toBe(true);
      expect(['BODY', 'DIALOG']).not.toContain(document.activeElement?.tagName);
    });
  }
});

describe('trailing clicks never reach the game', () => {
  /** Once the Hub closed, the pointer is over the game. */
  const landsOnGame = () => (hubOpen() ? undefined : gameCanvas());
  /** A fresh click a moment later, somewhere else, reaches the game as one press. */
  async function freshPress(wait = 400) {
    stamp += wait; await vi.advanceTimersByTimeAsync(wait);
    dispatchPress(gameCanvas(), 1, { x: 30, y: 300 });
    expect(canvas()).toEqual(['pointerdown:0', 'mousedown:1', 'mouseup:1', 'click:1']);
  }
  const closing: Record<string, { open(): Promise<HTMLElement> | HTMLElement; count: number }> = {
    'Continue row': { open: () => row('Eye of the North'), count: 2 },
    'Close button': { open: () => byRole('button', 'Close Hub', true)[0]!, count: 3 },
    'backdrop': { open: () => document.getElementById('hub')!, count: 2 },
    'Xunlai Storage': { open: async () => { fill(search(), 'storage'); await settle(); return row('Xunlai Storage'); }, count: 2 },
    'character card': { open: async () => { press('Meta+e'); await settle(); return document.querySelector<HTMLElement>('button[data-character-key="mesmer"]')!; }, count: 2 },
  };
  for (const [name, subject] of Object.entries(closing)) {
    test(`${name}: a closing double-click and triple-click leave the canvas untouched`, async () => {
      await mountFixture();
      const target = await subject.open();
      window.gwFixtureCanvas?.clear();
      await clicks(target, subject.count, 120, landsOnGame);
      expect(hubOpen()).toBe(false);
      expect(canvas()).toEqual([]);
      await freshPress();
    });
  }

  for (const [name, query, pick, destination] of [
    ['whisper romi', 'whisper romi', '', '#whisper-window'],
    ['Whispers tool', '', 'whispers', '#whisper-window'],
    ['trade arms', 'trade arms', '', '#toolbox-trade'],
    ['Trade Chat tool', '', 'trade', '#toolbox-trade'],
  ] as const) {
    test(`a double-clicked ${name} handoff keeps typing in its destination`, async () => {
      await mountFixture();
      fill(search(), query); await settle();
      await clicks(pick ? byId(pick) : document.querySelector('#hub .hub-row')!, 2, 120, landsOnGame);
      type('w1 hi');
      const active = document.activeElement instanceof HTMLInputElement ? document.activeElement : null;
      expect({ value: active?.value, inside: !!active?.closest(destination) }).toEqual({ value: expect.stringContaining('w1 hi'), inside: true });
      expect(canvas()).toEqual([]);
    });
  }
});

const recent = (name: string) => [...document.querySelectorAll<HTMLElement>('.travel-recent')].find(candidate => candidate.textContent!.includes(name))!;
const move = (target: Element, by = 4) => target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, movementX: by, movementY: by }));

test('Travel: a click selects a destination and the footer travels once', async () => {
  await mountFixture();
  press('Meta+t'); await settle();
  const kaineng = recent('Kaineng Center');
  await clicks(kaineng, 1);
  expect(kaineng.getAttribute('aria-selected')).toBe('true');
  expect(document.querySelector('#hub .hub-primary')!.textContent).toBe('Travel to Kaineng Center · Any district↵');
  expect(document.activeElement?.id).toBe('travel-search-input');
  expect(ledger()).toEqual([]);
  await clicks(primary(), 1);
  expect(ledger()).toEqual(['TRAVEL Kaineng Center']);
});

describe('a clicked row keeps the footer while the pointer crosses other rows to it (D-24)', () => {
  const subjects: Record<string, { open(): Promise<HTMLElement> | HTMLElement; named: RegExp; ran: string[] }> = {
    'Home: Continue Eye of the North': { open: () => row('Eye of the North'), named: /^Travel to Eye of the North/, ran: ['TRAVEL Eye of the North'] },
    'Travel: Kaineng Center (TRV-07)': { open: async () => { press('Meta+t'); await settle(); return recent('Kaineng Center'); }, named: /^Travel to Kaineng Center · Any district/, ran: ['TRAVEL Kaineng Center'] },
    'build target: Apply to me (BLD-09)': { open: async () => { await enter('build smiter'); return byRole('option', 'Apply to me')[0]!; }, named: /^Apply Smiter to Fixture Monk/, ran: ['apply-build', 'command:1', 'command:2'] },
  };
  for (const [name, subject] of Object.entries(subjects)) {
    test(name, async () => {
      await mountFixture();
      const target = await subject.open();
      await clicks(target, 1);
      expect(primary().textContent).toMatch(subject.named);
      const others = [...document.querySelectorAll<HTMLElement>('#hub [role="option"]')].filter(option => option !== target);
      expect(others.length).toBeGreaterThan(0);
      for (const other of others) move(other);
      expect(target.getAttribute('aria-selected')).toBe('true');
      expect(primary().textContent).toMatch(subject.named);
      await clicks(primary(), 1);
      expect(ledger()).toEqual(subject.ran);
    });
  }

  test('hover selects again once the pointer leaves the list or a key moves the selection', async () => {
    await mountFixture();
    const eye = row('Eye of the North');
    await clicks(eye, 1);
    move(row('Kaineng Center'));
    expect(eye.getAttribute('aria-selected')).toBe('true');
    // The pointer leaves the list, comes back, and a real move selects the row under it.
    document.querySelector('.hub-results')!.dispatchEvent(new PointerEvent('pointerleave'));
    move(row('Kaineng Center'));
    expect(row('Kaineng Center').getAttribute('aria-selected')).toBe('true');
    // A key moves the selection past a click's hold too.
    await clicks(row('Kaineng Center'), 1);
    press('ArrowDown');
    expect(row('Kaineng Center').getAttribute('aria-selected')).toBe('false');
    move(row('Kaineng Center'));
    expect(row('Kaineng Center').getAttribute('aria-selected')).toBe('true');
    expect(ledger()).toEqual([]);
  });
});

const card = (key: string) => document.querySelector<HTMLElement>(`button[data-character-key="${key}"]`)!;

describe('characters', () => {
  test('rapid clicks on an unchanged page still count', async () => {
    await mountFixture();
    press('Meta+e'); await settle();
    expect(card('monk').getAttribute('aria-selected')).toBe('true');
    await clicks(byRole('button', 'Next character')[0]!, 2);
    expect(card('mesmer').getAttribute('aria-selected')).toBe('true');
    expect(ledger()).toEqual([]);
  });

  test('a multi-click on a card that raises Leave this area? never confirms it', async () => {
    for (const count of [2, 3]) {
      await mountFixture('&lifecycle=pve-explorable');
      press('Meta+e'); await settle(); press('End');
      // The later presses land on what the confirmation shows: its Leave button.
      await clicks(card('toefte'), count, 120, () => byRole('button', 'Leave and switch to Toefte', true)[0]!);
      expect(document.getElementById('character-switch-title')!.textContent).toBe('Leave this area and switch to Toefte?');
      const leave = byRole('button', 'Leave and switch to Toefte', true)[0]!;
      expect(ledger()).toEqual([]);
      await until(() => leave.hasAttribute('data-armed'));
      await clicks(leave, 1);
      expect(ledger()).toEqual(['Character toefte']);
    }
  });
});

describe('a navigational row opens a page whose controls sit under the pointer', () => {
  const toggles = () => JSON.stringify(window.gwToolsSettings?.());
  const whispers = () => [...document.querySelectorAll<HTMLElement>('.hub-settings-host label strong')].find(element => element.textContent!.trim() === 'Whispers');
  test('a double-click that opens Settings never toggles a setting', async () => {
    await mountFixture();
    const before = toggles();
    for (const how of ['row', 'typed'] as const) {
      if (how === 'typed') { fill(search(), 'settings'); await settle(); }
      const target = how === 'row' ? byId('settings') : document.querySelector<HTMLElement>('.hub-row')!;
      stamp += 1_000;
      dispatchPress(target, 1);
      await until(() => whispers());
      // The second press, 120 ms after the first, lands on the Whispers setting that the new page shows there.
      stamp += 120;
      dispatchPress(whispers()!, 2);
      await settle();
      expect(caption()).toBe('Settings');
      expect(toggles()).toBe(before);
      if (how === 'row') { byRole('button', 'Home', true)[0]!.click(); await settle(); }
    }
    // A deliberate single click still toggles exactly once.
    stamp += 1_000;
    dispatchPress(whispers()!, 1);
    await until(() => toggles() !== before);
  });
});

describe('the footer primary', () => {
  test('a double-click never runs the next page\'s primary', async () => {
    await mountFixture();
    fill(search(), 'build smiter'); await settle();
    expect(primary().textContent).toMatch(/^Choose target/);
    await clicks(primary(), 2);
    expect(caption()).toBe('Smiter');
    expect(primary().textContent).toMatch(/^Apply Smiter to Fixture Monk/);
    expect(primary().hasAttribute('disabled')).toBe(false);
    press('Meta+Backspace'); await settle();
    fill(search(), 'team gom'); await settle();
    expect(primary().textContent).toMatch(/^Review GOM AFK/);
    await clicks(primary(), 2);
    expect(caption()).toBe('GOM AFK');
    // The review keeps the Hub footer: its named primary is Apply, enabled and not run. It opens
    // with the page itself focused, not the Apply control (HUB-084).
    expect(primary().textContent).toBe('Apply team GOM AFK↵');
    expect(primary().hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(document.querySelector('.hub-build-review'));
    const lifecycle = (value: string) => { const select = document.querySelector<HTMLSelectElement>('select[aria-label="Lifecycle state"]')!; select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); };
    lifecycle('pve-explorable');
    press('Meta+r'); await settle(); fill(search(), 'team gom afk'); await settle(); press('ArrowRight'); await settle();
    expect(document.querySelector('.hub-build-review [role=status]')!.textContent).toBe('Enter an outpost to apply this team.');
    expect(document.activeElement instanceof HTMLButtonElement && document.activeElement.disabled).not.toBe(true);
    expect(document.activeElement).toBe(document.querySelector('.hub-build-review'));
    expect(primary().hasAttribute('disabled')).toBe(true);
    lifecycle('outpost');
    // Playwright's fill leaves the caret at the end; the same text typed again keeps this DOM's caret where it was.
    fill(search(), 'team gom afk'); search().setSelectionRange(12, 12); await settle(); press('ArrowRight'); await settle();
    expect(primary().hasAttribute('disabled')).toBe(false);
    expect(document.activeElement).toBe(document.querySelector('.hub-build-review'));
    expect(ledger()).toEqual([]);
    await clicks(primary(), 3);
    expect(ledger().filter(entry => entry === 'apply-team')).toHaveLength(1);
  });
});

describe('other click runs', () => {
  test('a person page\'s world actions only select on a click', async () => {
    await mountFixture('&party');
    await enter('zed delta');
    expect(caption()).toBe('Zed Delta');
    await vi.advanceTimersByTimeAsync(600);
    for (const [title, footer] of [['Invite to party', /^Invite Zed Delta/], ['Travel and invite', /^Travel and invite Zed Delta/], ['Travel to outpost', /^Travel to \S/]] as const) {
      const target = row(title);
      if (!target) continue;
      await clicks(target, 1);
      expect(target.getAttribute('aria-selected'), title).toBe('true');
      expect(primary().textContent, title).toMatch(footer);
    }
    expect(ledger()).toEqual([]);
    expect(hubOpen()).toBe(true);
  });

  test('a double-click on the calculator card copies once', async () => {
    await mountFixture();
    fill(search(), '10 ecto in p'); await settle();
    await clicks(document.querySelector('#hub .hub-conversion')!, 2);
    expect(ledger().filter(entry => entry.startsWith('Copied'))).toHaveLength(1);
    // One named receipt, in the status line of the Hub that stays open (D-8).
    expect(document.querySelector('#hub .hub-status')!.textContent).toMatch(/^Copied “.*60 platinum/);
    if (!hubOpen()) { byRole('button', 'Open Hub', true)[0]!.click(); await settle(); }
    fill(search(), '10 ecto in p'); await settle();
    await clicks(document.querySelector('#hub .hub-conversion')!, 3);
    expect(ledger().filter(entry => entry.startsWith('Copied'))).toHaveLength(2);
    expect(canvas().filter(event => !/:(0|1)$/u.test(event))).toEqual([]);
  });

  test('Clear search cannot reuse a previous Travel destination click (HUB-242)', async () => {
    await mountFixture();
    press('Meta+t'); await settle();
    await clicks(document.getElementById('travel-recent-194')!, 1);
    const input = narrow(HTMLInputElement, document.getElementById('travel-search-input'));
    fill(input, 'zzzzqq'); await settle();
    // The second press of the double-click lands on the destination that comes back once the search is clear.
    await clicks(byRole('button', 'Clear search', true)[0]!, 2, 120, () => document.getElementById('travel-recent-194') ?? undefined);
    expect(input.value).toBe('');
    expect(caption()).toBe('Travel');
    expect(ledger()).toEqual([]);
  });
});

/** Chromium sends the click of a press and release on different elements to their nearest common ancestor. */
function dragClick(from: Element, to: Element, ancestor: Element) {
  const init = { bubbles: true, cancelable: true, composed: true, button: 0 };
  from.dispatchEvent(new PointerEvent('pointerdown', init));
  if (from.dispatchEvent(new MouseEvent('mousedown', { ...init, detail: 1 }))) (from.closest<HTMLElement>('input, button, [tabindex]'))?.focus();
  to.dispatchEvent(new PointerEvent('pointerup', init));
  to.dispatchEvent(new MouseEvent('mouseup', { ...init, detail: 1 }));
  ancestor.dispatchEvent(new MouseEvent('click', { ...init, detail: 1 }));
}

describe('a press that ends on another element', () => {
  test('pressing on one row and releasing on another activates neither', async () => {
    await mountFixture();
    for (const [from, to, query] of [['Kamadan', 'Kaineng Center', ''], ['Settings', 'Show Launcher', 's']] as const) {
      fill(search(), query); await settle();
      dragClick(row(from), row(to), document.querySelector('.hub-results')!);
      await vi.advanceTimersByTimeAsync(300);
      expect(ledger()).toEqual([]);
      expect(caption()).toBe('Home');
      expect(document.activeElement).toBe(search());
    }
  });

  // HUB-052: pointer origin decides dismissal; a backdrop click suspends the mounted task.
  test('dragging out preserves the Hub query, and a backdrop click resumes the same task', async () => {
    await mountFixture();
    press('Meta+b'); await settle(); fill(search(), 'smiter'); await settle();
    dragClick(search(), document.getElementById('hub')!, document.getElementById('hub')!);
    expect(hubOpen()).toBe(true);
    expect(search().value).toBe('smiter');
    await clicks(document.getElementById('hub')!, 1);
    expect(hubOpen()).toBe(false);
    press('Meta+r'); await settle();
    expect(caption()).toBe('Build Library');
    expect(search().value).toBe('smiter');
    expect(document.activeElement).toBe(search());
  });
});

describe('Hub preferences', () => {
  const pins = ['place:449', 'place:194', 'place:642'];
  const savedIds = () => {
    const saved: { id: string }[] = JSON.parse(localStorage.getItem('hub-fixture-shortcuts') ?? '[]');
    return saved.map(entry => entry.id);
  };
  const options = () => [...byRole('listbox', 'Pins and search phrases')[0]!.querySelectorAll<HTMLElement>('[role=option]')].map(option => option.textContent!.trim());
  test('a double-click on Move up moves the same pin twice and saves the order (PTR-12)', async () => {
    await mountFixture();
    const set = window.gwNative.settings.set({ hubShortcuts: pins.map(id => ({ id, phrase: '', pinned: true })) }); await vi.advanceTimersByTimeAsync(10); await set; await settle();
    await enter('hub preferences');
    expect(options()).toEqual([expect.stringMatching(/^Kamadan/), expect.stringMatching(/^Kaineng Center/), expect.stringMatching(/^Eye of the North/)]);
    // The list takes focus, never a Remove button; the footer names what Enter does.
    expect(document.activeElement).toBe(byRole('listbox', 'Pins and search phrases')[0]);
    expect(primary().textContent).toMatch(/^Set phrase for Kamadan/);
    click(byRole('option', 'Eye of the North')[0]!); await vi.advanceTimersByTimeAsync(20);
    expect(byRole('option', 'Eye of the North')[0]!.getAttribute('aria-selected')).toBe('true');
    const up = byRole('button', 'Move up', true)[0]!;
    for (const gap of [0, 120]) {
      await clicks(up, 2, gap);
      expect(options()).toEqual([expect.stringMatching(/^Eye of the North/), expect.stringMatching(/^Kamadan/), expect.stringMatching(/^Kaineng Center/)]);
      expect(document.activeElement).toBe(up);
      expect(up.getAttribute('aria-disabled')).toBe('true');
      expect(savedIds()).toEqual(['place:642', 'place:449', 'place:194']);
      if (!gap) { press('Alt+Meta+ArrowDown'); press('Alt+Meta+ArrowDown'); await vi.advanceTimersByTimeAsync(20); expect(options()[2]).toMatch(/^Eye of the North/); }
    }
  });
});
