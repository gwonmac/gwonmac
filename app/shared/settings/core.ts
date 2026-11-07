/**
 * The settings no feature owns: appearance, graphics, app shortcuts, Hub
 * preferences, updates and diagnostics. Feature settings live in their
 * app/features/<id>/feature.ts. Key names and stored shapes are player data.
 */
import { isDigest } from "../digest.js";
import { DEFAULT_CALCULATOR_RATES, parseCalculatorRates, type CalculatorRates } from "../hub-calculator.js";
import { isHubShortcuts, type HubShortcut } from "../hub-preferences.js";
import { isShortcutOverrides, type ShortcutOverrides } from "../keyboard-shortcuts.js";
import { DEFAULT_CUSTOM_UI_THEME, normaliseCustomUiTheme, type CustomUiTheme } from "../ui-theme.js";
import { setting } from "./define.js";

export const UI_STYLES = ["guild-wars", "obsidian", "custom"] as const;
export type UiStyle = (typeof UI_STYLES)[number];
export const UI_FONTS = ["guild-wars", "inter", "system", "avenir", "georgia", "palatino"] as const;
export type UiFont = (typeof UI_FONTS)[number];
export const CONTROLLER_PROMPT_STYLES = ["game-default", "playstation"] as const;
export type ControllerPromptStyle = (typeof CONTROLLER_PROMPT_STYLES)[number];
export const RENDER_SCALES = [1, 1.5, 2] as const;
export type RenderScale = (typeof RENDER_SCALES)[number];
export const UI_PANEL_OPACITY_MIN = 65;
export const UI_PANEL_OPACITY_MAX = 100;
export const UI_TEXT_SIZE_MIN = 100;
export const UI_TEXT_SIZE_MAX = 200;
export const LAST_UPDATE_CHECK_AT_MAX = 8_640_000_000_000_000;

const copied = <T extends object>(read: (value: unknown) => T | null) => (value: unknown): T | undefined =>
  read(value) ?? undefined;

export const CORE_SETTINGS = {
  renderScale: setting.enum(RENDER_SCALES, 2, {
    hub: true,
    error: "settings.renderScale has unknown type/value",
    launcherError: "render scale is invalid",
  }),
  /** The visual treatment applied to every GWonMac panel. */
  uiStyle: setting.enum(UI_STYLES, "guild-wars", {
    hub: true,
    error: "settings.uiStyle has unknown value",
    launcherError: "Panel style is invalid",
  }),
  /** The one saved player palette, retained even while a built-in style is active. */
  uiCustomTheme: setting.value(DEFAULT_CUSTOM_UI_THEME, copied(normaliseCustomUiTheme), {
    hub: true,
    launcherError: "Custom panel colors are invalid",
    fresh: () => ({ ...DEFAULT_CUSTOM_UI_THEME }),
  }),
  /** The typeface applied to every GWonMac panel. */
  uiFont: setting.enum(UI_FONTS, "guild-wars", {
    hub: true,
    error: "settings.uiFont has unknown value",
    launcherError: "Panel font is invalid",
  }),
  /** Visual style for Guild Wars' controller-button texture atlas. */
  controllerPromptStyle: setting.enum(CONTROLLER_PROMPT_STYLES, "game-default", {
    hub: true,
    error: "settings.controllerPromptStyle has unknown value",
    launcherError: "Controller symbols are invalid",
  }),
  /**
   * The application's Guild Wars panels stay translucent enough to see the
   * game behind them. This is presentation only and never reaches the game.
   */
  uiPanelOpacity: setting.integer(94, { min: UI_PANEL_OPACITY_MIN, max: UI_PANEL_OPACITY_MAX }, {
    hub: true,
    launcherError: "Panel opacity is invalid",
  }),
  /** Interface text size in percent; never scales Guild Wars. */
  uiTextSize: setting.integer(100, { min: UI_TEXT_SIZE_MIN, max: UI_TEXT_SIZE_MAX }, {
    hub: true,
    launcherError: "Text size must be from 100% to 200%",
  }),
  /** Player changes to the app-owned shortcuts; missing entries use defaults. */
  shortcutOverrides: setting.value(
    {},
    (value): ShortcutOverrides | undefined => isShortcutOverrides(value) ? { ...value } : undefined,
    { tools: true, error: "settings.shortcutOverrides has invalid bindings" },
  ),
  hubShortcuts: setting.value(
    [],
    // Build and team pins belong to the Build Library's own store.
    (value): readonly HubShortcut[] | undefined => isHubShortcuts(value) && !value.some(entry => /^(build|team):/u.test(entry.id))
      ? value.map(entry => ({ ...entry }))
      : undefined,
    { rendererWritable: true, tools: true, error: "Invalid Hub shortcuts" },
  ),
  /** Optional estimates and selected source, shared across game windows. */
  calculatorRates: setting.value(
    DEFAULT_CALCULATOR_RATES,
    (value): CalculatorRates | undefined => {
      try { return parseCalculatorRates(value); } catch { return undefined; }
    },
    { rendererWritable: true, tools: true },
  ),
  /** Request the certified 4 GB client module on the next Guild Wars launch. */
  extendedMemoryEnabled: setting.boolean(false, { hub: true }),
  /** Return toward the current character after an explicit game reload. */
  autoRelogAfterReload: setting.boolean(false, { hub: true, rendererWritable: true }),
  /** Warning position within the available viewport space; null keeps the default. */
  memoryWarningPosition: setting.value(
    null,
    (position): Readonly<{ x: number; y: number }> | null | undefined => {
      if (position === null) return null;
      if (typeof position !== "object" || Array.isArray(position)
        || !("x" in position) || !("y" in position)
        || Object.keys(position).length !== 2
        || typeof position.x !== "number" || !Number.isFinite(position.x)
        || typeof position.y !== "number" || !Number.isFinite(position.y)
        || position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1) return undefined;
      return { x: position.x, y: position.y };
    },
    { rendererWritable: true, error: "settings.memoryWarningPosition must contain x and y between 0 and 1" },
  ),
  showDiagnostics: setting.boolean(false, { hub: true }),
  /**
   * Automatic release checks: one static channel request when no settled
   * attempt was recorded in the previous six hours, including across app
   * restarts. It is on by default so players stay current and declared plainly
   * wherever the checkbox appears. `false` means no automatic update request;
   * opting out is one checkbox, honored forever.
   */
  autoCheckUpdates: setting.boolean(true, { launcher: true }),
  /**
   * When the last release-check attempt completed, in epoch milliseconds, or
   * `null` if one has never run. This records a settled attempt, not a claim
   * that a network request reached its destination.
   */
  lastUpdateCheckAt: setting.value(
    null,
    (at): number | null | undefined => at === null || (
      typeof at === "number" && Number.isSafeInteger(at) && at >= 0 && at <= LAST_UPDATE_CHECK_AT_MAX
    ) ? at : undefined,
    { error: "settings.lastUpdateCheckAt must be null or epoch milliseconds" },
  ),
  /**
   * The ArenaNet client build (its official module's sha256) whose
   * compatibility notice the player has already seen, or `null` for none.
   *
   * Keyed by build rather than by a boolean on purpose: a new ArenaNet build
   * has to warn again, and the same one must not nag every launch. It is not
   * nested with the two update fields above because it is not about updating
   * this app — it records what the player was told about *their game client*.
   */
  compatibilityNoticeSeenFor: setting.value(
    null,
    (seen): string | null | undefined => seen === null || isDigest(seen) ? seen : undefined,
    { error: "settings.compatibilityNoticeSeenFor must be null or a client sha256" },
  ),
};
