/**
 * What each app shortcut does, as data that main (app/main/window.ts) and the Hub fixture
 * (app/ui/tools/src/hub-fixture-main.ts) share: the renderer commands main sends, in order, or
 * the map layer setting it flips. A shortcut runs only while its feature is selected
 * (SHORTCUT_FEATURES); the renderer refuses what it cannot do.
 */
import type { AppSettings, RendererCommand } from "./contracts.js";
import type { ShortcutAction } from "../features/index.js";

/** The map layers a shortcut flips in settings; no renderer command runs. */
export const SHORTCUT_MAP_LAYERS = {
  "cartography.grid.toggle": "cartographyGridEnabled",
  "cartography.walkability.toggle": "cartographyOverlayEnabled",
} as const satisfies Partial<Record<ShortcutAction, keyof AppSettings>>;

type CommandAction = Exclude<ShortcutAction, keyof typeof SHORTCUT_MAP_LAYERS>;
/**
 * The commands each shortcut sends. An action that opens a surface over the game clears held
 * input first. Main sends Resign's through `showResignGame` (window-menu.ts), which checks the
 * switch again and holds the key until they are sent.
 */
export const SHORTCUT_COMMANDS: Readonly<Record<CommandAction, readonly RendererCommand[]>> = {
  "game.call-target": [{ type: "game.call-target" }],
  "game.resign": [{ type: "input.reset" }, { type: "game.resign" }],
  "character.switch": [{ type: "input.reset" }, { type: "character.toggle" }],
  "tools.toggle": [{ type: "tools.toggle" }],
  "whispers.toggle": [{ type: "whispers.toggle" }],
  "trade.toggle": [{ type: "trade.toggle" }],
  "storage.open": [{ type: "input.reset" }, { type: "storage.open" }],
  "travel.open": [{ type: "input.reset" }, { type: "travel.toggle" }],
};

export const isMapLayerShortcut = (action: ShortcutAction): action is keyof typeof SHORTCUT_MAP_LAYERS => action in SHORTCUT_MAP_LAYERS;
