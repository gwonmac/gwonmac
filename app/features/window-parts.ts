/**
 * Every feature's window part (the `window` kind, app/renderer/window-part.ts): one line per
 * feature whose manifest lists "window", sorted by folder. The Tools window
 * (app/renderer/toolbox-foundation.ts) hosts each one; it names none of them.
 *
 * Renderer only, and Tools only: the Tools window is its one importer, and the Tools companion
 * and the host-only Tools window load that behind Core's dynamic import. Each declaration is
 * small; its view loads lazily when its window first opens.
 */
import buildLibrary from "./build-library/renderer/window.js";
import tradeChat from "./trade-chat/renderer/window.js";
import type { WindowPart } from "../renderer/window-part.js";

export const WINDOW_PARTS: readonly WindowPart[] = Object.freeze([buildLibrary, tradeChat]);
