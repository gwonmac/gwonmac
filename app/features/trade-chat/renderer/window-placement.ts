/**
 * Owns where the Trade window sits and how large it is: the `tradeChatWindowPosition` setting,
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

const STORED_KEY = "gwonmac.trade-window-placement";

const save = (tradeChatWindowPosition: FloatingWindowPlacement) => {
  void window.gwNative.settings.set({ tradeChatWindowPosition }).catch(() => undefined);
};

/** The place the player gave the window before it moved into settings, or null; read once. */
function takeStoredPlace(): FloatingWindowPlacement | null {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORED_KEY);
    window.localStorage.removeItem(STORED_KEY);
  } catch { return null; }
  return parseFloatingWindowPlacement(stored);
}

export function tradeWindowPlacement(): FloatingWindowPlacementStore {
  let checked = false;
  /** The moved place, until the setting holds it (a settings change may arrive before the save). */
  let moved: FloatingWindowPlacement | null = null;
  const read = () => {
    const setting = window.gwToolsSettings().tradeChatWindowPosition;
    if (setting !== null) moved = null;
    return setting ?? moved;
  };
  return Object.freeze({
    subscribe(listener: (placement: FloatingWindowPlacement | null) => void) {
      if (!checked) {
        checked = true;
        const stored = takeStoredPlace();
        if (read() === null && stored !== null) { moved = stored; save(stored); }
      }
      listener(read());
      const changed = () => listener(read());
      window.addEventListener("gw:tools-settings", changed);
      return () => window.removeEventListener("gw:tools-settings", changed);
    },
    save,
  });
}
