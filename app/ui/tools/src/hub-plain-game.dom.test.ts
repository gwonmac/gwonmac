/**
 * The plain game is the official client with nothing added, so the Hub never opens while it
 * is on. The launcher turns it on and off; a game window only follows it. Runs the real Hub on
 * the fixture page.
 */
import { afterEach, beforeAll, expect, test } from 'vitest';
import { loadFixture, mountFixture, press, settle, unmountFixture } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const hubOpen = () => document.getElementById('hub')?.hasAttribute('open') ?? false;
const caption = () => document.querySelector('.hub-caption')?.textContent;
const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const setPlainGame = async (on: boolean) => {
  window.dispatchEvent(new CustomEvent('hub-fixture-settings', {
    detail: { plainGame: on ? { gwonmacTools: true, characterSwitchEnabled: true } : null },
  }));
  await settle();
};

test('turning the plain game on closes an open Hub, and no shortcut or call opens it again', async () => {
  await mountFixture();
  expect(hubOpen()).toBe(true);
  await setPlainGame(true);
  expect(hubOpen()).toBe(false);
  for (const key of ['Meta+r', 'Meta+t', 'Meta+e', 'Meta+b']) {
    press(key); await settle();
    expect([key, hubOpen()]).toEqual([key, false]);
  }
  window.gwHub!.show(); await settle();
  expect(hubOpen()).toBe(false);
});

test('turning the plain game off brings the Hub back at Home', async () => {
  await mountFixture();
  await setPlainGame(true);
  expect(hubOpen()).toBe(false);
  await setPlainGame(false);
  press('Meta+r'); await settle();
  expect([hubOpen(), caption(), document.activeElement === search()]).toEqual([true, 'Home', true]);
});
