import { expect, test, type Page } from '@playwright/test';
import { reportTimings } from './performance-budget.js';
import type { HubSource } from '../../../shared/hub.js';
import { openHub } from './hub-page.js';

declare global { interface Window { hubRowDraws?: () => { added: number; redrawn: number } } }
/**
 * Installs `window.hubRowDraws()`: the result rows Vue added and redrew since the last call.
 * Vue's dev build, which the fixture server runs, replaces the vnode it keeps on an element on
 * every redraw, even one that changes no attribute (the vitest twin:
 * src/hub-scale-a11y.dom.test.ts). The 1000-row specs gate on these counts, not on time.
 */
async function countRowDraws(page: Page) {
  await page.evaluate(() => {
    let drawn = new WeakMap<Element, unknown>();
    window.hubRowDraws = () => {
      const next = new WeakMap<Element, unknown>();
      let added = 0, redrawn = 0;
      for (const row of document.querySelectorAll('.hub-row')) {
        const vnode = (row as Element & { __vnode?: unknown }).__vnode;
        if (vnode === undefined) throw new Error('The Hub fixture runs Vue\'s dev build, which keeps a vnode on each element.');
        if (!drawn.has(row)) added++; else if (drawn.get(row) !== vnode) redrawn++;
        next.set(row, vnode);
      }
      drawn = next;
      return { added, redrawn };
    };
    window.hubRowDraws();
  });
}

// Waits for the whole list, which paints 10 rows a frame in the background; headless CI frames
// are slow, so 1000 rows can take longer than the default 5 s. This is a wait, not a time budget.
const PAINT_ALL = 20_000;

test('root typing and the whole 1000-build Library add at most one chunk of rows a task (HUB-110, 112, 169)', { tag: '@macos' }, async ({ page }, info) => {
  await openHub(page, '&library=1000');
  await countRowDraws(page);
  const { draws, ...timings } = await page.evaluate(async () => {
    const rowDraws = window.hubRowDraws!;
    const input = document.querySelector<HTMLInputElement>('.hub-search input')!;
    const longTasks: number[] = [];
    const observer = new PerformanceObserver(entries => longTasks.push(...entries.getEntries().map(entry => entry.duration)));
    observer.observe({ type: 'longtask' });
    const typing: number[] = [], paints: number[] = [];
    const draws = { typing: [] as number[], entry: { added: 0, redrawn: 0 }, frames: [] as { added: number; redrawn: number }[] };
    for (const query of ['m', '', 'm', 'mo', 'mon', 'mo', 'm', '']) {
      const key = query.length < input.value.length ? 'Backspace' : query.at(-1) ?? 'Backspace';
      const started = performance.now();
      // Real typing runs the key handler before input; include its layout cost in the report.
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      input.value = query; input.dispatchEvent(new Event('input', { bubbles: true }));
      typing.push(performance.now() - started); draws.typing.push(rowDraws().added);
      await new Promise(requestAnimationFrame); paints.push(performance.now() - started); rowDraws();
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    const rootLongTasks = [...longTasks, ...observer.takeRecords().map(record => record.duration)];
    longTasks.length = 0; rowDraws();
    const started = performance.now(); window.gwHub!.openRow('builds', 'builds', 'Build Library is unavailable.');
    const entry = performance.now() - started;
    draws.entry = rowDraws();
    // Count every frame's rows until the whole Library is in the DOM.
    while (document.querySelectorAll('.hub-build-row').length < 1000) { await new Promise(requestAnimationFrame); draws.frames.push(rowDraws()); }
    // Long-task delivery is asynchronous; wait for the observer before reporting it.
    await new Promise(resolve => setTimeout(resolve, 100));
    longTasks.push(...observer.takeRecords().map(record => record.duration));
    observer.disconnect();
    return { draws, typing, paints, entry, rootLongTasks, libraryLongTasks: longTasks };
  });
  await reportTimings(info, 'scale-timings', timings);
  // One chunk is ten rows (app/renderer/hub.ts). A frame that fills in rows redraws none of the rows already drawn.
  expect(Math.max(...draws.typing)).toBeLessThanOrEqual(10);
  expect(draws.entry.added).toBeLessThanOrEqual(10);
  expect(Math.max(...draws.frames.map(frame => frame.added))).toBeLessThanOrEqual(10);
  expect(draws.frames.filter(frame => frame.redrawn > 0)).toEqual([]);
});

test('suspension retains the selected row across a resume (HUB-171)', async ({ page }) => {
  await openHub(page, '&library=1000');
  const search = page.locator('.hub-search input');
  await search.fill('build m');
  await search.press('ArrowDown');
  const selected = await page.locator('#hub [aria-selected="true"]').getAttribute('data-id');
  await page.evaluate(() => window.gwHub?.suspend());
  await expect(page.locator('#hub')).toBeHidden();
  await expect.poll(() => page.locator('.hub-row').count()).toBeGreaterThan(100);
  await page.evaluate(() => window.gwHub?.resume());
  await expect(page.locator('#hub [aria-selected="true"]')).toHaveAttribute('data-id', selected!);
});


test('source bursts coalesce while typing stays synchronous and opening searches once (HUB-111)', async ({ page }) => {
  await openHub(page, '&library=1000&templates-ms=1000');
  const result = await page.evaluate(async () => {
    const hub = window.gwHub!;
    let calls = 0;
    let notify = () => {};
    const detach = hub.attach({
      search() { calls++; return []; },
      subscribe(listener) { notify = listener; return () => {}; },
      setVisible(visible) { if (visible) { notify(); notify(); } },
    });
    await new Promise(requestAnimationFrame);
    calls = 0;
    for (let index = 0; index < 20; index++) notify();
    const beforeFrame = calls;
    await new Promise(requestAnimationFrame);
    const afterFrame = calls;
    calls = 0;
    const input = document.querySelector<HTMLInputElement>('.hub-search input')!;
    input.value = 'mo'; input.dispatchEvent(new Event('input', { bubbles: true }));
    const typing = calls;
    hub.close(); calls = 0; hub.show();
    const opening = calls;
    await new Promise(requestAnimationFrame);
    const afterOpeningFrame = calls;
    detach();
    return { beforeFrame, afterFrame, typing, opening, afterOpeningFrame };
  });
  expect(result).toEqual({ beforeFrame: 0, afterFrame: 1, typing: 1, opening: 1, afterOpeningFrame: 1 });
});

test('End scrolls its row into view and Back returns to the same place in the 1000-build Library (HUB-112)', async ({ page }) => {
  await openHub(page, '&library=1000');
  // Entry and End in one task: later frames cannot have painted the last row yet.
  const end = await page.evaluate(() => {
    window.gwHub!.openRow('builds', 'builds', 'Build Library is unavailable.');
    const input = document.querySelector<HTMLInputElement>('.hub-search input')!;
    const painted = document.querySelectorAll('.hub-row').length;
    const height = document.getElementById('hub-results')!.getBoundingClientRect().height;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    const option = document.getElementById(input.getAttribute('aria-activedescendant') ?? '');
    const list = document.getElementById('hub-results')!.getBoundingClientRect(), box = option?.getBoundingClientRect();
    return { painted, height, heightAfter: list.height, last: option === [...document.querySelectorAll('.hub-row')].at(-1), selected: option?.getAttribute('aria-selected'),
      visible: !!box && box.top >= list.top - 1 && box.bottom <= list.bottom + 1 };
  });
  expect(end.heightAfter).toBe(end.height);
  expect([end.last, end.selected, end.visible]).toEqual([true, 'true', true]);
  // A place far below the first painted rows, once every row is in; the row opened there ends above the list's end.
  const search = page.locator('.hub-search input');
  await search.press('Home');
  await expect(page.locator('.hub-build-row')).toHaveCount(1000, { timeout: PAINT_ALL });
  const list = page.locator('#hub-results');
  await list.evaluate(element => { element.scrollTop = element.scrollHeight / 2; });
  const middle = () => list.evaluate(element => {
    const box = element.getBoundingClientRect();
    const row = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)!.closest<HTMLElement>('.hub-row')!;
    return { id: row.dataset.id!, top: row.getBoundingClientRect().top - box.top };
  });
  const place = await middle();
  // The same row at the same height, give or take the browser rounding a scroll offset to a pixel.
  const atPlace = async () => { const now = await middle(); return now.id === place.id && Math.abs(now.top - place.top) <= 1; };
  await page.locator(`.hub-row[data-id="${place.id}"]`).click();
  await expect(page.locator('.hub-caption')).not.toHaveText('Build Library');
  await page.keyboard.press('Meta+Backspace');
  await expect(page.locator('.hub-caption')).toHaveText('Build Library');
  // Back paints the rows around the place first and fills in the rows above it while scroll
  // anchoring holds the rows in view, so the same row stands at the same height at once and stays.
  expect(await atPlace()).toBe(true);
  await expect(page.locator('.hub-build-row')).toHaveCount(1000, { timeout: PAINT_ALL });
  expect(await atPlace()).toBe(true);
});

test('placement moves 48px with Shift and 16px without, and the footer keeps its height (HUB-164)', async ({ page }) => {
  await openHub(page);
  const lock = page.getByRole('button', { name: 'Lock Hub position', exact: true });
  const panel = page.locator('.hub-panel');
  const footer = page.locator('.hub-footer');
  const footerHeight = (await footer.boundingBox())!.height;
  await lock.click();
  const initial = (await panel.boundingBox())!;
  await lock.press('Alt+Shift+ArrowLeft');
  expect((await panel.boundingBox())!.x).toBeCloseTo(initial.x - 48);
  await lock.press('Alt+ArrowRight');
  expect((await panel.boundingBox())!.x).toBeCloseTo(initial.x - 32);
  expect((await footer.boundingBox())!.height).toBe(footerHeight);
});

test('breadcrumb focus leaves space around its text and outline (HUB-165)', async ({ page }) => {
  await openHub(page);
  const search = page.locator('.hub-search input');
  await search.fill('settings'); await search.press('Enter');
  const home = page.getByRole('button', { name: 'Home', exact: true });
  await home.focus();
  const geometry = await home.evaluate(button => {
    const style = getComputedStyle(button);
    const parent = getComputedStyle(button.parentElement!);
    return { padding: parseFloat(style.paddingLeft), offset: parseFloat(style.outlineOffset), room: parseFloat(parent.paddingLeft) };
  });
  expect(geometry.padding).toBeGreaterThanOrEqual(4);
  expect(geometry.offset).toBeGreaterThan(0);
  expect(geometry.room).toBeGreaterThanOrEqual(3);
  await expect(home).toBeFocused();
});


test('twenty opens and resumes search once and add at most one chunk of rows each (HUB-111, 171)', { tag: '@macos' }, async ({ page }, info) => {
  await openHub(page, '&library=1000&templates-ms=1000');
  await countRowDraws(page);
  const { passes, added, remaining, ...timings } = await page.evaluate(async () => {
    const hub = window.gwHub!, rowDraws = window.hubRowDraws!;
    let calls = 0;
    const detach = hub.attach({ search() { calls++; return []; }, setVisible() {}, subscribe() { return () => {}; } } satisfies HubSource);
    const opens: number[] = [], paints: number[] = [], resumes: number[] = [], passes: number[] = [], added: number[] = [];
    const input = document.querySelector<HTMLInputElement>('.hub-search input')!;
    for (let cycle = 0; cycle < 20; cycle++) {
      hub.close(); calls = 0; rowDraws();
      const started = performance.now(); hub.show(); opens.push(performance.now() - started);
      passes.push(calls); added.push(rowDraws().added); await new Promise(requestAnimationFrame); paints.push(performance.now() - started);
      input.value = 'm'; input.dispatchEvent(new Event('input', { bubbles: true }));
      hub.suspend(); calls = 0; rowDraws();
      const resumed = performance.now(); hub.resume(); resumes.push(performance.now() - resumed);
      passes.push(calls); added.push(rowDraws().added); await new Promise(requestAnimationFrame);
    }
    hub.close(); const remaining = document.querySelectorAll('#hub-results .hub-row').length;
    detach(); return { opens, paints, resumes, passes, added, remaining };
  });
  await reportTimings(info, 'twenty-open-timings', timings);
  expect(passes).toEqual(Array(40).fill(1));
  expect(Math.max(...added)).toBeLessThanOrEqual(10);
  expect(remaining).toBe(0);
});


test('incoming bursts keep a deep build scrolled and draw no row (HUB-111, 112)', { tag: '@macos' }, async ({ page }, info) => {
  await openHub(page, '&library=1000');
  const search = page.locator('.hub-search input');
  await search.fill('build library'); await search.press('Enter');
  await expect(page.locator('.hub-build-row')).toHaveCount(1000, { timeout: PAINT_ALL });
  await countRowDraws(page);
  const deep = page.locator('.hub-row[data-id="build:scale-500"]');
  await deep.scrollIntoViewIfNeeded();
  await deep.dispatchEvent('pointermove', { movementX: 1 });
  await expect(deep).toHaveAttribute('aria-selected', 'true');
  const result = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('.hub-search input')!;
    const list = document.querySelector<HTMLElement>('#hub-results')!;
    const tasks: number[] = [], mutations: number[] = [];
    const observer = new PerformanceObserver(entries => tasks.push(...entries.getEntries().map(entry => entry.duration)));
    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
    observer.observe({ type: 'longtask' }); window.hubRowDraws!();
    for (let message = 0; message < 40; message++) {
      window.dispatchEvent(new Event('hub-fixture-incoming'));
      await new Promise(resolve => setTimeout(resolve, 125));
    }
    const burst = window.hubRowDraws!();
    const selected = list.querySelector<HTMLElement>('[aria-selected="true"]')!.dataset.id;
    const scroll = list.scrollTop;
    for (let arrow = 0; arrow < 10; arrow++) {
      const changes = new MutationObserver(() => {}); changes.observe(list, { attributes: true, subtree: true });
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      mutations.push(changes.takeRecords().length); changes.disconnect(); await new Promise(requestAnimationFrame);
    }
    await new Promise(resolve => setTimeout(resolve, 100)); tasks.push(...observer.takeRecords().map(record => record.duration)); observer.disconnect();
    return { selected, scroll, mutations, burst, tasks };
  });
  await reportTimings(info, 'incoming-burst', { tasks: result.tasks });
  expect(result.scroll).toBeGreaterThan(0);
  expect(result.selected).toBe('build:scale-500');
  // The Library's rows draw the same, so the burst draws none of them; an arrow changes only the old and new rows.
  expect(result.burst).toEqual({ added: 0, redrawn: 0 });
  expect(Math.max(...result.mutations)).toBeLessThanOrEqual(4);
});
