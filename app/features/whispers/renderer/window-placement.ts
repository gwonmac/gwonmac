/**
 * Owns where the Whispers panel sits and how large it is: the `whispersWindowPosition` setting,
 * which every game window reads back, so all of them follow a move and Copy settings carries it.
 *
 * One-time move (docs/migrations.md): the place used to live in the game window's browser
 * storage. While the setting is unset, that place is read once as its first value; the old entry
 * is then removed.
 */
import {
  parseFloatingWindowPlacement,
  type FloatingWindowPlacement,
  type FloatingWindowPlacementStore,
} from "../../../shared/ui/window-placement.js";
import type { Block } from "../../../renderer/game-blocks.js";

const STORED_KEY = "gwonmac.whispers-window-placement";

const save = (whispersWindowPosition: FloatingWindowPlacement) => {
  void window.gwNative.settings.set({ whispersWindowPosition }).catch(() => undefined);
};

/** The place the player gave the panel before it moved into settings, or null; read once. */
function takeStoredPlace(): FloatingWindowPlacement | null {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORED_KEY);
    window.localStorage.removeItem(STORED_KEY);
  } catch { return null; }
  return parseFloatingWindowPlacement(stored);
}

export function whisperWindowPlacement(
  settings: Pick<Block<Readonly<{ whispersWindowPosition: FloatingWindowPlacement | null }>>, "subscribe">,
): FloatingWindowPlacementStore {
  let checked = false;
  /** The moved place, until the setting holds it (a settings change may arrive before the save). */
  let moved: FloatingWindowPlacement | null = null;
  return Object.freeze({
    subscribe: (listener: (placement: FloatingWindowPlacement | null) => void) => settings.subscribe(({ whispersWindowPosition }) => {
      if (!checked) {
        checked = true;
        const stored = takeStoredPlace();
        if (whispersWindowPosition === null && stored !== null) { moved = stored; save(stored); }
      }
      if (whispersWindowPosition !== null) moved = null;
      listener(whispersWindowPosition ?? moved);
    }),
    save,
  });
}
