/**
 * The settings file: its shape rule, its recovery behaviour, and nothing about
 * what any individual setting means.
 *
 * Unknown fields are ignored on read and are not preserved on the next write;
 * this is deliberate, not a compatibility bag. In a player's file a malformed
 * known value costs only that setting: it takes its default, every other value
 * is kept, the original bytes are preserved beside the file, and the repaired
 * file is written so the reset is reported once. A file that is not a JSON
 * object, or has a format version this build does not recognise, is moved
 * aside intact and defaults are used, so an unreadable profile costs a player
 * their preferences and never their downloaded game data.
 *
 * `parseSettingsPatch` rejects an unknown key outright instead of dropping it,
 * because a silently ignored key is indistinguishable to the renderer from a
 * setting that did not stick.
 */
import { readFile } from "node:fs/promises";
import type { AppSettingsPatch, RendererSettingsPatch } from "../../shared/contracts.js";
import {
  DEFAULT_SETTINGS,
  RENDERER_WRITABLE_SETTINGS,
  SETTING_KEYS,
  readSettings,
  type AppSettings,
} from "../../shared/settings/index.js";
import { AppError } from "../../shared/errors.js";
import { normaliseCartographyPresetRef } from "../../shared/cartography-overlay.js";
import { writeAtomicJson } from "./atomic-file.js";
import { preserveCorruptDocument, quarantineCorruptDocument } from "./corrupt-document.js";

const SETTINGS_KEYS = new Set<string>(SETTING_KEYS);
const SETTINGS_FORMAT = 1;

/**
 * The document's own shape: an object, in a format this build reads.
 *
 * A file with no `formatVersion` is what the public alpha wrote. v0 and v1
 * are the same shape — only the marker is new — so the legacy read is the
 * ordinary read, and an alpha profile keeps every value it had. A version
 * this build does not know is refused rather than reinterpreted; `loadSettings`
 * then moves it aside intact instead of trusting a shape it cannot read.
 */
function settingsDocument(raw: unknown): Readonly<Record<string, unknown>> {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError("bad_settings", "settings must be an object");
  }
  const src = raw as Record<string, unknown>;
  if (src.formatVersion !== undefined && src.formatVersion !== SETTINGS_FORMAT) {
    throw new AppError(
      "bad_settings",
      `settings.formatVersion ${JSON.stringify(src.formatVersion)} is not readable`,
    );
  }
  return src;
}

/**
 * Strict read for values that did not come from the player's file (renderer
 * patches, a save): ignore unknown fields, fill missing from defaults, and
 * refuse a malformed known value. Each field's shape is its setting's
 * (app/shared/settings).
 */
export function parseSettings(raw: unknown): AppSettings {
  const { settings, unreadable: [first] } = readSettings(settingsDocument(raw));
  if (first) throw new AppError("bad_settings", first.error);
  return settings;
}

export function parseSettingsPatch(raw: unknown): AppSettingsPatch {
  if (raw === null || raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError("bad_settings", "settings patch must be an object");
  }
  const src = raw as Record<string, unknown>;
  const unknownKey = Object.keys(src).find((key) => !SETTINGS_KEYS.has(key));
  if (unknownKey) {
    throw new AppError(
      "bad_settings",
      `settings patch has unknown field ${JSON.stringify(unknownKey)}`,
    );
  }
  const parsed = parseSettings(src);
  const patch: AppSettingsPatch = {};
  for (const key of SETTING_KEYS) {
    if (Object.hasOwn(src, key)) {
      Object.assign(patch, { [key]: parsed[key] });
    }
  }
  return patch;
}

/** The generic renderer bridge cannot bypass Travel's compare-and-refuse path. */
export function parseRendererSettingsPatch(raw: unknown): RendererSettingsPatch {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AppError("bad_settings", "settings patch must be an object");
  }
  const src = raw as Record<string, unknown>;
  const allowed = new Set<string>([
    ...RENDERER_WRITABLE_SETTINGS,
    "cartographyPresetSelection",
  ]);
  const unknownKey = Object.keys(src).find((key) => !allowed.has(key));
  if (unknownKey) {
    throw new AppError(
      "bad_settings",
      `game renderer cannot update ${JSON.stringify(unknownKey)}`,
    );
  }
  const hasSelection = Object.hasOwn(src, "cartographyPresetSelection");
  if (hasSelection && Object.keys(src).length !== 1) {
    throw new AppError(
      "bad_settings",
      "settings preset selection must be one atomic operation",
    );
  }
  if (hasSelection) {
    const selection = normaliseCartographyPresetRef(src.cartographyPresetSelection);
    if (selection === null) {
      throw new AppError("bad_settings", "settings.cartographyPresetSelection is invalid");
    }
    return { cartographyPresetSelection: selection };
  }
  const parsed = parseSettingsPatch(src);
  const patch: Partial<Pick<AppSettings, (typeof RENDERER_WRITABLE_SETTINGS)[number]>> = {};
  for (const key of RENDERER_WRITABLE_SETTINGS) {
    if (Object.hasOwn(src, key)) Object.assign(patch, { [key]: parsed[key] });
  }
  return patch;
}

/**
 * What `loadSettings` did to a file it could not read as written. `fields` are
 * the stored field names that took their defaults: names only, never values.
 */
export type SettingsRecovery =
  | Readonly<{ kind: "file"; backupPath: string }>
  | Readonly<{ kind: "fields"; backupPath: string; fields: readonly string[] }>;

export async function loadSettings(
  path: string,
  onRecovered?: (recovery: SettingsRecovery) => void | Promise<void>,
): Promise<AppSettings> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return { ...DEFAULT_SETTINGS };
    throw e;
  }
  let document: Readonly<Record<string, unknown>>;
  try {
    document = settingsDocument(JSON.parse(text));
  } catch {
    const backupPath = await quarantineCorruptDocument(path);
    if (backupPath) await onRecovered?.({ kind: "file", backupPath });
    return { ...DEFAULT_SETTINGS };
  }
  const { settings, unreadable } = readSettings(document);
  if (unreadable.length === 0) return settings;
  const backupPath = await preserveCorruptDocument(path, text);
  const repaired = await saveSettings(path, settings);
  await onRecovered?.({ kind: "fields", backupPath, fields: unreadable.map(({ field }) => field) });
  return repaired;
}

export async function saveSettings(path: string, value: AppSettings): Promise<AppSettings> {
  const cleaned = parseSettings(value);
  await writeAtomicJson(path, {
    formatVersion: SETTINGS_FORMAT,
    ...cleaned,
  });
  return cleaned;
}
