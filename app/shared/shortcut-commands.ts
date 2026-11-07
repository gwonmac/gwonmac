/**
 * What each app shortcut does, as data that main (app/main/window.ts) and the Hub fixture
 * (app/ui/tools/src/hub-fixture-main.ts) share: the renderer commands main sends, in order, or
 * the map layer setting it flips. Main sends a shortcut only while its feature is turned on in
 * the live settings (SHORTCUT_FEATURES). The renderer (app/renderer/commands.ts) acts on a tool
 * command only in a launch that selected Tools, turns it into its tool's event
 * (TOOL_COMMAND_EVENTS, app/shared/hub-tools.ts) and refuses what no listener claims.
 */
import type { AppSettings, RendererCommand } from "./contracts.js";
import type { ShortcutAction } from "../features/index.js";

/** The map layers a shortcut flips in settings; no renderer command runs. */
export const SHORTCUT_MAP_LAYERS = {
  "cartography.grid.toggle": "cartographyGridEnabled",
  "cartography.walkability.toggle": "cartographyOverlayEnabled",
} as const satisfies Partial<Record<ShortcutAction, keyof AppSettings>>;

export type ShortcutCommandAction = Exclude<ShortcutAction, keyof typeof SHORTCUT_MAP_LAYERS>;
/**
 * The commands each shortcut sends; main's one sender is `runShortcut` (app/main/renderer-commands.ts),
 * for the shortcut and its menu item alike. An action that opens a surface over the game clears
 * held input first: a sheet or palette takes focus, and ⌘⇧C can lose its modifier releases in
 * AppKit after Chromium forwarded Shift. The overlays (Build Library, Trade Chat, Whispers) take
 * no focus, so a held movement key keeps acting. Resign runs through `showResignGame`
 * (window-menu.ts), which checks its switch again first.
 */
export const SHORTCUT_COMMANDS: Readonly<Record<ShortcutCommandAction, readonly RendererCommand[]>> = {
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

export const isShortcutCommandAction = (action: string): action is ShortcutCommandAction => Object.hasOwn(SHORTCUT_COMMANDS, action);
