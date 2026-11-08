import { expect, test } from '@playwright/test';
import { timeBudget } from './performance-budget.js';

test.use({ locale: 'en-US', timezoneId: 'UTC' });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-30T12:00:00Z'));
});

test('the price-basis picker keeps keyboard focus through changes and Enter', async ({ page }) => {
  await page.goto('/?hub');
  await page.locator('.hub-search input').fill('1zkey in a');
  const picker=page.getByRole('combobox',{name:'Price basis'});
  await picker.focus();
  for(const side of ['wtb','wts']){
    await picker.selectOption(side);
    await expect(picker).toBeFocused();
    await picker.press('Enter');
    await expect(picker).toBeFocused();
  }
});

test('the rates a player saves survive a reload', async ({ page }) => {
  await page.goto('/?hub&settings-ms=1000');
  const search=page.locator('.hub-search input');
  await search.fill('rates'); await search.press('Enter');
  await page.getByRole('combobox',{name:'Rate source'}).selectOption('manual');
  await page.getByRole('textbox',{name:'Gold per ectoplasm'}).fill('5k');
  await page.getByRole('textbox',{name:'Ectoplasm per armbrace'}).fill('30');
  const key=page.getByRole('textbox',{name:'Ectoplasm per Zaishen key'});await key.fill('.5');
  await key.press('Meta+Enter');
  await expect(page.locator('.hub-view [role=status]')).toHaveText('Your rates saved. Go back to your conversion.');
  await page.reload();await search.fill('10e in p');await expect(page.locator('.hub-conversion')).toContainText('50 platinum');
});

test('a missing quote wraps its detail', async ({ page }) => {
  await page.goto('/?hub');
  const search=page.locator('.hub-search input');await search.fill('1 iron in g');
  const row=page.locator('.hub-row[aria-selected=true]');await expect(row).toContainText('Iron Ingot');
  await expect(row.locator('.hub-detail')).toHaveCSS('white-space','normal');
});

test('a per-item question stays legible at narrow widths', async ({ page }) => {
  await page.setViewportSize({width:500,height:650});await page.goto('/?hub');
  const search=page.locator('.hub-search input');await search.fill('14a per stack in e each');
  await expect(page.locator('.hub-conversion-input')).toHaveCSS('white-space','normal');
  const originalFont = await page.locator('.hub-conversion-input').evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  await page.locator('.hub-conversion').evaluate(card => {
    for (const node of card.querySelectorAll<HTMLElement>('.hub-conversion-input, .hub-title, .hub-currency, .hub-detail')) node.style.fontSize = `${parseFloat(getComputedStyle(node).fontSize) * 2}px`;
  });
  const bounds = await page.locator('.hub-conversion').evaluate(card => {
    const question = card.querySelector('.hub-conversion-input')!;
    const range = document.createRange(); range.selectNodeContents(question);
    const box = card.getBoundingClientRect();
    return { overflow: card.scrollWidth - card.clientWidth, font: getComputedStyle(question).fontSize,
      inside: [...range.getClientRects()].every(rect => rect.left >= box.left && rect.right <= box.right && rect.top >= box.top && rect.bottom <= box.bottom) };
  });
  expect(parseFloat(bounds.font)).toBe(originalFont * 2);
  expect(bounds.overflow).toBeLessThanOrEqual(1);
  expect(bounds.inside).toBe(true);
});

test('a quote and Enter copy within the time budget, reading quotes once (HUB-104, HUB-098)', { tag: '@macos' }, async ({ page }) => {
  await page.goto('/?hub');
  const search = page.locator('.hub-search input');
  await expect(search).toBeVisible();
  await page.evaluate(() => {
    const native=window.gwNative;if(!('trade' in native))throw new Error('The Hub fixture runs with Tools.');
    let reads=0; const get=native.trade.getTraderQuotes;
    native.trade.getTraderQuotes=async()=>{document.documentElement.dataset.quoteReads=String(++reads);return get();};
  });
  await search.fill('10e in p');
  await expect(page.locator('.hub-row[aria-selected=true]')).toHaveAttribute('data-id','quote:result');
  // Dispatch the final digit and Enter in one browser turn, excluding driver latency.
  const copied = await search.evaluate(input => {
    const field=input as HTMLInputElement; let payload=''; let elapsed=Infinity;
    const start=performance.now();
    window.gwNative.clipboard.writeText=async value=>{payload=value;elapsed=performance.now()-start;};
    field.value='10005e in p';field.dispatchEvent(new Event('input',{bubbles:true}));
    field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    return {payload,elapsed};
  });
  expect(copied.payload).toBe('10005 e = 60,030 platinum (sample) · Buy from trader · Current observation 9/30/2026, 12:00:00 PM · Kamadan · Estimate');
  expect(copied.elapsed).toBeLessThanOrEqual(timeBudget(10));
  await expect(page.locator('html')).toHaveAttribute('data-quote-reads','1');
});
