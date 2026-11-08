/**
 * The owned press (HUB-003) on the real Hub fixture: a press that a Hub row or page acted on
 * belongs to the Hub until its key-up. Its auto-repeats and its key-up never reach the game,
 * also after the Hub closed, and it runs its action once; the next press reaches the game again.
 */
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { fill, hold, keyDown, keyUp, loadFixture, mountFixture, press, settle, shown, unmountFixture, until } from './hub-fixture-harness';

beforeAll(loadFixture);
afterEach(unmountFixture);

const canvasKeys = () => (window.gwFixtureCanvas?.events ?? []).map(event => `${event.type}:${event.code}${event.repeat ? ':repeat' : ''}`);
const actions = (pattern: RegExp) => (window.gwFixtureActions ?? []).filter(action => pattern.test(action));
const search = () => document.querySelector<HTMLInputElement>('.hub-search input')!;
const hubOpen = () => shown(document.getElementById('hub')!);
const action = () => document.getElementById('app')?.dataset.action;
/** Holds a key with the canvas log cleared first, and returns what reached the canvas. */
async function held(key: string, repeats = 3) {
  window.gwFixtureCanvas?.clear();
  hold(key, repeats);
  await settle();
  return canvasKeys();
}
/** A fresh press after the Hub's own reaches the game, down and up. */
async function nextKeyReachesGame() {
  window.gwFixtureCanvas?.clear();
  press('w'); await settle();
  return [document.activeElement?.id, canvasKeys()];
}
const game = ['canvas', ['keydown:KeyW', 'keyup:KeyW']];

test('a held Escape that closes the Hub never reaches the game', async () => {
  await mountFixture();
  expect([await held('Escape'), hubOpen()]).toEqual([[], false]);
});

// PPL-15: one physical press sends one invite, tapped or held with auto-repeat.
test.each([0, 3])('the Enter that invites and closes the Hub keeps its release, and the next key reaches the game (%i repeats)', async repeats => {
  await mountFixture('&party');
  fill(search(), 'invite Romi Ranger'); await settle();
  expect(await held('Enter', repeats)).toEqual([]);
  expect([action(), document.getElementById('app')?.dataset.invites, actions(/^PARTY\./u)])
    .toEqual(['PARTY.INVITE Romi Ranger', 'Romi Ranger', ['PARTY.INVITE Romi Ranger']]);
  expect(await nextKeyReachesGame()).toEqual(game);
});

// BLD-14: Enter stays held while the team applies and the Hub closes; its repeats keep coming
// after the close and none of them, nor the key-up, reaches the game.
test('a held Enter that applies a team applies it once and never reaches the game', async () => {
  await mountFixture();
  fill(search(), 'team gom afk');
  await until(() => document.querySelector<HTMLButtonElement>('.hub-primary')?.textContent?.includes('Apply team GOM AFK') && !document.querySelector<HTMLButtonElement>('.hub-primary')!.disabled);
  window.gwFixtureCanvas?.clear();
  keyDown('Enter');
  for (let repeat = 0; repeat < 30 && hubOpen(); repeat++) { await vi.advanceTimersByTimeAsync(50); keyDown('Enter', true); }
  expect(hubOpen()).toBe(false);
  for (let repeat = 0; repeat < 3; repeat++) keyDown('Enter', true);
  keyUp('Enter'); await settle();
  expect([canvasKeys(), actions(/^apply-/u), action()?.startsWith('command:')]).toEqual([[], ['apply-team'], true]);
  expect(await nextKeyReachesGame()).toEqual(game);
});

test.each([
  ['a search result', async () => { fill(search(), 'travel kam'); await settle(); }, 'TRAVEL Kamadan, Jewel of Istan'],
  ['a Travel destination', async () => { press('Escape'); press('Meta+t'); await settle(); press('1'); await settle(); }, 'TRAVEL Ascalon City'],
  ['a character', async () => { press('Escape'); press('Meta+e'); await settle(); press('6'); await settle(); }, 'Character toefte'],
])('a held Enter that travels or switches from %s runs once and never reaches the game', async (_name, open, ran) => {
  await mountFixture();
  await open();
  expect([await held('Enter'), action()]).toEqual([[], ran]);
  expect(await nextKeyReachesGame()).toEqual(game);
});

test.each([0, 3])('the Enter that hands a person to Whispers never reaches the game (%i repeats)', async repeats => {
  await mountFixture();
  fill(search(), 'romi'); press('Enter'); await settle();
  expect(document.querySelector('.hub-caption')?.textContent).toBe('Romi Ranger');
  expect([await held('Enter', repeats), shown(document.getElementById('whisper-window')!)]).toEqual([[], true]);
});
