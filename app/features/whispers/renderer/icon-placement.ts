/**
 * Owns where Whispers' unread icon sits: the `whispersIconPosition` setting, which every game
 * window reads back, so all of them follow a move and Copy settings carries it.
 *
 * One-time move (docs/migrations.md): the icon's place used to live in this window's
 * browser storage. While the setting is unset, that place is read once as its first value; the old
 * entry is then removed.
 */
import { readCornerPlacement } from "../../../shared/overlay-placement.js";
import type { CornerPosition } from "../../../shared/corner-position.js";
import type { WhisperIconPlacement } from "../../../shared/tools-bundle-contracts.js";
import type { Block } from "../../../renderer/game-blocks.js";

const STORED_KEY = "gwonmac.whispers-icon-placement";

const save = (whispersIconPosition: CornerPosition) => {
  void window.gwNative.settings.set({ whispersIconPosition }).catch(() => undefined);
};

/** The place the player gave the icon before it moved into settings, or null; read once. */
function takeStoredPlace(): CornerPosition | null {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORED_KEY);
    window.localStorage.removeItem(STORED_KEY);
  } catch { return null; }
  if (stored === null) return null;
  let value: unknown;
  try { value = JSON.parse(stored); } catch { return null; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { formatVersion, ...place } = value as Record<string, unknown>;
  return formatVersion === 1 ? readCornerPlacement(place) ?? null : null;
}

export function whisperIconPlacement(settings: Block<Readonly<{ whispersIconPosition: CornerPosition | null }>>): WhisperIconPlacement {
  let checked = false;
  return Object.freeze({
    subscribe: (listener: (position: CornerPosition | null) => void) => settings.subscribe(({ whispersIconPosition }) => {
      if (!checked) {
        checked = true;
        const stored = takeStoredPlace();
        if (whispersIconPosition === null && stored !== null) { save(stored); listener(stored); return; }
      }
      listener(whispersIconPosition);
    }),
    save,
  });
}
