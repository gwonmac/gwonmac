import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { timeBudget } from './performance-budget.js';
import type { HubSource } from '../../../shared/hub.js';

test('root typing and complete library entry stay within the scale budget (HUB-110, 112, 169)', { tag: '@macos' }, async ({ page }, info) => {
  await page.goto('/?hub&library=1000');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const timings = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('.hub-search input')!;
    const longTasks: number[] = [];
    const observer = new PerformanceObserver(entries => longTasks.push(...entries.getEntries().map(entry => entry.duration)));
    observer.observe({ type: 'longtask' });
    const typing: number[] = [];
    const paints: number[] = [];
    // The first keystroke also pays one-time costs (first search, cold code) that take several
    // frames on a slow CI runner; the long-task budget bounds it. Only later keys get the frame budget.
    for (const query of ['m', '', 'm', 'mo', 'mon', 'mo', 'm', '']) {
      const key = query.length < input.value.length ? 'Backspace' : query.at(-1) ?? 'Backspace';
      const started = performance.now();
      // Real typing runs the key handler before input; include its layout cost in the budget.
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      input.value = query; input.dispatchEvent(new Event('input', { bubbles: true }));
      typing.push(performance.now() - started);
      await new Promise(requestAnimationFrame); paints.push(performance.now() - started);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    const rootLongTasks = [...longTasks, ...observer.takeRecords().map(record => record.duration)];
    longTasks.length = 0;
    const started = performance.now(); window.gwHub!.openRow('builds', 'builds', 'Build Library is unavailable.');
    const entry = performance.now() - started;
    // Observe every deferred batch, including those beyond the first 100 ms.
    while (document.querySelectorAll('.hub-build-row').length < 1000) await new Promise(requestAnimationFrame);
    const row = document.querySelector<HTMLElement>('.hub-build-row')!;
    const height = row.getBoundingClientRect().height;
    // Long-task delivery is asynchronous; wait for the observer before judging its evidence.
    await new Promise(resolve => setTimeout(resolve, 100));
    longTasks.push(...observer.takeRecords().map(record => record.duration));
    observer.disconnect();
    return { typing, paints, entry, rootLongTasks, libraryLongTasks: longTasks, height };
  });
  await writeFile(info.outputPath('scale-timings.json'), JSON.stringify(timings, null, 2));
  await info.attach('scale-timings.json', { body: JSON.stringify(timings, null, 2), contentType: 'application/json' });
  expect(Math.max(...timings.typing.slice(2))).toBeLessThan(timeBudget(32));
  expect(Math.max(...timings.paints.slice(2))).toBeLessThanOrEqual(timeBudget(32));
  expect(timings.rootLongTasks.filter(duration => duration > timeBudget(50))).toEqual([]);
  expect(timings.entry).toBeLessThan(timeBudget(100));
  expect(timings.libraryLongTasks.filter(duration => duration > timeBudget(50))).toEqual([]);
});

test('suspension retains the selected row across a ⌘R reopen (HUB-171)', async ({ page }) => {
  await page.goto('/?hub&library=1000');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const search = page.locator('.hub-search input');
  await search.fill('build m');
  await search.press('ArrowDown');
  const selected = await page.locator('#hub [aria-selected="true"]').getAttribute('data-id');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#hub')).toBeHidden();
  await expect.poll(() => page.locator('.hub-row').count()).toBeGreaterThan(100);
  await page.keyboard.press('Meta+r');
  await expect(page.locator('#hub [aria-selected="true"]')).toHaveAttribute('data-id', selected!);
});


test('source bursts coalesce while typing stays synchronous and opening searches once (HUB-111)', async ({ page }) => {
  await page.goto('/?hub&library=1000&templates-ms=1000');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
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

test('End scrolls its row into view and Back restores the scroll in the 1000-build Library (HUB-112)', async ({ page }) => {
  await page.goto('/?hub&library=1000');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
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
  expect(end.visible).toBe(true);
  // A place far below the first painted rows; the row opened there ends above the list's end.
  const search = page.locator('.hub-search input');
  await search.press('Home');
  const list = page.locator('#hub-results');
  await list.evaluate(element => { element.scrollTop = element.scrollHeight / 2; });
  const scroll = await list.evaluate(element => element.scrollTop);
  const id = await list.evaluate(element => {
    const box = element.getBoundingClientRect();
    return document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)!.closest<HTMLElement>('.hub-row')!.dataset.id!;
  });
  await page.locator(`.hub-row[data-id="${id}"]`).click();
  await expect(page.locator('.hub-caption')).not.toHaveText('Build Library');
  await page.keyboard.press('Meta+Backspace');
  await expect(page.locator('.hub-caption')).toHaveText('Build Library');
  expect(await list.evaluate(element => element.scrollTop)).toBe(scroll);
});

test('placement moves 48px with Shift and 16px without, and the footer keeps its height (HUB-164)', async ({ page }) => {
  await page.goto('/?hub');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
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
  await page.goto('/?hub');
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


test('twenty opens and resumes stay within the time budget (HUB-111, 171)', { tag: '@macos' }, async ({ page }, info) => {
  await page.goto('/?hub&library=1000&templates-ms=1000');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const result = await page.evaluate(async () => {
    const hub = window.gwHub!;
    let calls = 0;
    const detach = hub.attach({ search() { calls++; return []; }, setVisible() {}, subscribe() { return () => {}; } } satisfies HubSource);
    const opens: number[] = [], paints: number[] = [], resumes: number[] = [], passes: number[] = [];
    const input = document.querySelector<HTMLInputElement>('.hub-search input')!;
    for (let cycle = 0; cycle < 20; cycle++) {
      hub.close(); calls = 0;
      const started = performance.now(); hub.show(); opens.push(performance.now() - started);
      passes.push(calls); await new Promise(requestAnimationFrame); paints.push(performance.now() - started);
      input.value = 'm'; input.dispatchEvent(new Event('input', { bubbles: true }));
      window.dispatchEvent(new Event('blur')); calls = 0;
      const resumed = performance.now(); hub.show(); resumes.push(performance.now() - resumed);
      passes.push(calls); await new Promise(requestAnimationFrame);
    }
    hub.close(); const remaining = document.querySelectorAll('#hub-results .hub-row').length;
    detach(); return { opens, paints, resumes, passes, remaining };
  });
  await info.attach('twenty-open-timings.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(Math.max(...result.opens)).toBeLessThanOrEqual(timeBudget(16));
  expect(Math.max(...result.paints)).toBeLessThanOrEqual(timeBudget(32));
  expect(Math.max(...result.resumes)).toBeLessThanOrEqual(timeBudget(32));
});


test('incoming bursts keep a deep build scrolled and cause no long task (HUB-111, 112)', { tag: '@macos' }, async ({ page }, info) => {
  await page.goto('/?hub&library=1000');
  await expect(page.locator('#app')).toHaveAttribute('data-ready', 'true');
  const search = page.locator('.hub-search input');
  await search.fill('build library'); await search.press('Enter');
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
    observer.observe({ type: 'longtask' });
    for (let message = 0; message < 40; message++) {
      window.dispatchEvent(new Event('hub-fixture-incoming'));
      await new Promise(resolve => setTimeout(resolve, 125));
    }
    const selected = list.querySelector<HTMLElement>('[aria-selected="true"]')!.dataset.id;
    const scroll = list.scrollTop;
    for (let arrow = 0; arrow < 10; arrow++) {
      const changes = new MutationObserver(() => {}); changes.observe(list, { attributes: true, subtree: true });
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      mutations.push(changes.takeRecords().length); changes.disconnect(); await new Promise(requestAnimationFrame);
    }
    await new Promise(resolve => setTimeout(resolve, 100)); tasks.push(...observer.takeRecords().map(record => record.duration)); observer.disconnect();
    return { selected, scroll, mutations, tasks };
  });
  await info.attach('incoming-burst.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.scroll).toBeGreaterThan(0);
  expect(result.tasks.filter(duration => duration > timeBudget(50))).toEqual([]);
});
