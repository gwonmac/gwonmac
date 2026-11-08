/**
 * The one settings table: core settings plus every feature's settings, in that
 * order. `AppSettings`, the defaults, the file reader and every list of settings a
 * surface may see or change are derived here, never written by hand.
 */
import type { FeatureDefinition } from "../../features/define.js";
import { FEATURES, type Feature } from "../../features/index.js";
import { CORE_SETTINGS } from "./core.js";
import { settingError, type SettingSpec, type SettingValue } from "./define.js";

type UnionToIntersection<Union> =
  (Union extends unknown ? (value: Union) => void : never) extends (value: infer Each) => void ? Each : never;
type SettingSpecTable = typeof CORE_SETTINGS & UnionToIntersection<Extract<Feature, { settings: unknown }>["settings"]>;

/** Every persisted setting. Key names and value shapes are player data. */
export type AppSettings = { -readonly [Key in keyof SettingSpecTable]: SettingValue<SettingSpecTable[Key]> };
export type SettingKey = keyof AppSettings;
type KeysWith<Flag extends string> = {
  [Key in SettingKey]: SettingSpecTable[Key] extends Readonly<Record<Flag, true>> ? Key : never
}[SettingKey];

function settingTable(): ReadonlyMap<SettingKey, SettingSpec<unknown>> {
  const table = new Map<string, SettingSpec<unknown>>(Object.entries(CORE_SETTINGS));
  const features: readonly FeatureDefinition[] = FEATURES;
  for (const feature of features) {
    for (const [key, spec] of Object.entries(feature.settings ?? {})) {
      if (table.has(key)) throw new Error(`Setting ${key} is declared twice`);
      table.set(key, spec);
    }
  }
  return table as ReadonlyMap<SettingKey, SettingSpec<unknown>>;
}

export const SETTING_TABLE = settingTable();
const settingKeys = (include: (spec: SettingSpec<unknown>) => boolean) =>
  [...SETTING_TABLE].filter(([, spec]) => include(spec)).map(([key]) => key);

export const SETTING_KEYS: readonly SettingKey[] = [...SETTING_TABLE.keys()];

export const DEFAULT_SETTINGS = Object.fromEntries(
  [...SETTING_TABLE].map(([key, spec]) => [key, spec.fallback]),
) as AppSettings;

/**
 * The only settings a game renderer may write. Global launcher, update, Tools,
 * appearance, and diagnostics policy never crosses the game preload.
 */
export type RendererWritableSetting = KeysWith<"rendererWritable">;
export const RENDERER_WRITABLE_SETTINGS = settingKeys((spec) => spec.rendererWritable === true) as readonly RendererWritableSetting[];

/** The settings the game window's Settings page reads and changes. */
export type HubSetting = KeysWith<"hub">;
export const HUB_SETTINGS = settingKeys((spec) => spec.hub === true) as readonly HubSetting[];

/** The settings the launcher reads and changes: the Hub's, plus the launcher's own. */
export type LauncherSetting = HubSetting | KeysWith<"launcher">;
export const LAUNCHER_SETTINGS = settingKeys((spec) => spec.hub === true || spec.launcher === true) as readonly LauncherSetting[];

/** The settings a game renderer reads through `window.gwToolsSettings()`. */
export type ToolsSetting = KeysWith<"tools">;
export type ToolsSettings = Readonly<Pick<AppSettings, ToolsSetting>>;
export const TOOLS_SETTINGS = settingKeys((spec) => spec.tools === true) as readonly ToolsSetting[];

/** The renderer's view of `settings`; before the first settings arrive, of the defaults. */
export function toolsSettings(settings: AppSettings | null): ToolsSettings {
  const source = settings ?? DEFAULT_SETTINGS;
  return Object.freeze(Object.fromEntries(TOOLS_SETTINGS.map((key) => [key, source[key]]))) as ToolsSettings;
}

/** A stored field whose value no setting accepts; `field` is the name in the document. */
export type UnreadableSetting = Readonly<{ field: string; error: string }>;

/**
 * Reads every known field of a settings document: a missing field takes its
 * default, an unknown field is ignored, and a malformed known value takes its
 * default and is listed in `unreadable`. Whether an unreadable field is
 * refused (renderer input) or reset (a player's file) is the caller's choice.
 * The document's own shape (an object, its format version) is the caller's to
 * check.
 */
export function readSettings(source: Readonly<Record<string, unknown>>): Readonly<{
  settings: AppSettings;
  unreadable: readonly UnreadableSetting[];
}> {
  const settings: Record<string, unknown> = {};
  const unreadable: UnreadableSetting[] = [];
  for (const [key, spec] of SETTING_TABLE) {
    const stored = key in source ? key : spec.alias !== undefined && spec.alias in source ? spec.alias : null;
    const value = stored === null ? undefined : spec.read(source[stored]);
    if (stored !== null && value === undefined) unreadable.push({ field: stored, error: settingError(stored, spec) });
    // A read may answer `null` (a cleared value), so only `undefined` falls back.
    settings[key] = value !== undefined ? value : spec.fresh ? spec.fresh() : spec.fallback;
  }
  return { settings: settings as AppSettings, unreadable };
}
