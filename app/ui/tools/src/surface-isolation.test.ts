/**
 * The one list of game input a host surface stops (isolateFromGame): input
 * that starts inside a surface never reaches the game's window listeners, and
 * the returned remover lets it through again.
 */
import { describe, expect, it } from 'vitest';
// The production owner, exercised with real DOM events.
// eslint-disable-next-line no-restricted-imports
import { isolateFromGame } from '../../../renderer/non-activating-surface';

const GAME_INPUT = [
  'keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove',
  'mousedown', 'mouseup', 'mousemove', 'click', 'contextmenu', 'wheel',
];

describe('isolateFromGame', () => {
  it.each(GAME_INPUT)('stops %s inside the surface and releases it on removal', type => {
    const reached: string[] = [];
    const listener = (event: Event) => reached.push(event.type);
    window.addEventListener(type, listener);
    const surface = document.createElement('div');
    const button = surface.appendChild(document.createElement('button'));
    document.body.append(surface);
    const remove = isolateFromGame(surface);
    button.dispatchEvent(new Event(type, { bubbles: true }));
    expect(reached).toEqual([]);
    remove();
    button.dispatchEvent(new Event(type, { bubbles: true }));
    expect(reached).toEqual([type]);
    window.removeEventListener(type, listener);
    surface.remove();
  });
});
