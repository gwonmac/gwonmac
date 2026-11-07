/**
 * The settings file: its shape rule, its recovery behaviour, and nothing about
 * what any individual setting means.
 *
 * Unknown fields are ignored on read and are not preserved on the next write;
 * this is deliberate, not a compatibility bag. The signed release proof protects
 * every Stable-owned field. Returning to an older Stable can discard additive
 * candidate preferences; release planning must disclose that loss. A malformed
 * known value is refused. A format version this build does not recognise is
 * moved aside intact and defaults are used, so an unreadable profile costs a
 * player their preferences and never their downloaded game data.
 *
 * `parseSettingsPatch` rejects an unknown key outright instead of dropping it,
 * because a silently ignored key is indistinguishable to the renderer from a
 * setting that did not stick.
 */
import { readFile } from "node:fs/promises";
import {
  DEFAULT_SETTINGS,
  RENDERER_WRITABLE_SETTINGS,
  type AppSettings,
  type AppSettingsPatch,
  type RendererSettingsPatch,
} from "../../shared/contracts.js";
import { AppError } from "../../shared/errors.js";
import { normaliseCartographyPresetRef } from "../../shared/cartography-overlay.js";
import { SETTING_KEYS, readSettings } from "../../shared/settings/index.js";
import { writeAtomicJson } from "./atomic-file.js";
import { quarantineCorruptDocument } from "./corrupt-document.js";

const SETTINGS_KEYS = new Set<string>(SETTING_KEYS);
const SETTINGS_FORMAT = 1;

/**
 * Reject unknown types; ignore unknown fields; fill missing from defaults.
 * Each field's shape is its setting's (app/shared/settings).
 *
 * A file with no `formatVersion` is what the public alpha wrote. v0 and v1
 * are the same shape — only the marker is new — so the legacy read is the
 * ordinary read, and an alpha profile keeps every value it had. A version
 * this build does not know is refused rather than reinterpreted; `loadSettings`
 * then moves it aside intact instead of trusting a shape it cannot read.
 */
export function parseSettings(raw: unknown): AppSettings {
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
  return readSettings(src);
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

export async function loadSettings(
  path: string,
  onRecovered?: (backupPath: string) => void | Promise<void>,
): Promise<AppSettings> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return { ...DEFAULT_SETTINGS };
    throw e;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return recoverCorruptSettings(path, onRecovered);
  }
  try {
    return parseSettings(raw);
  } catch {
    return recoverCorruptSettings(path, onRecovered);
  }
}

async function recoverCorruptSettings(
  path: string,
  onRecovered: ((backupPath: string) => void | Promise<void>) | undefined,
): Promise<AppSettings> {
  const backupPath = await quarantineCorruptDocument(path);
  if (backupPath) await onRecovered?.(backupPath);
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(path: string, value: AppSettings): Promise<AppSettings> {
  const cleaned = parseSettings(value);
  await writeAtomicJson(path, {
    formatVersion: SETTINGS_FORMAT,
    ...cleaned,
  });
  return cleaned;
}
