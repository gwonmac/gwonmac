/**
 * Mounts the saved-library-only Tools window for a client with no usable companion. The game
 * host imports it lazily, so the window parts load only with Tools.
 *
 * The Tools window already owns the boundary — the toggle, the event stops, pointer-lock
 * release, the cursor mirror, focus transfer and teardown — so a window part needs none of that
 * again. Two boundaries around one panel is how a held movement key ends up stuck when only one
 * of them is torn down.
 */
import { createToolboxLifecycle } from "./toolbox-foundation.js";

/**
 * Mounts the saved-library-only Tools experience for an official client that
 * has no usable companion. This module already owns the Tools bundle boundary,
 * so it also owns the matching settings listener and teardown; the Emscripten
 * bootstrap only decides when this fallback is needed.
 */
export function mountHostOnlyTools(parent: HTMLElement): () => void {
  const lifecycle = createToolboxLifecycle(parent);
  const sync = () => lifecycle.sync();
  window.addEventListener("gw:tools-settings", sync);
  sync();
  return () => {
    window.removeEventListener("gw:tools-settings", sync);
    lifecycle.dispose();
  };
}
