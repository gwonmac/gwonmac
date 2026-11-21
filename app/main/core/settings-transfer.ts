/**
 * Owns the text form of a player's settings: what Copy settings writes and what Paste
 * settings accepts, so a player can carry their setup to another Mac.
 *
 * The text holds the stored settings and the launcher's Home choices. It never holds what
 * belongs to one machine or one moment: the last update check, the client
 * compatibility notice, and the stored Travel shortcuts, which Travel owns. Credentials are never in
 * the settings file, so they are never in the text. Reading is strict about
 * shape and lenient about age: a field this build does not know is left out and reported,
 * and every value that is kept passes the same validation as a settings file.
 */
import type { AppSettingsPatch } from "../../shared/contracts.js";
import { DEFAULT_SETTINGS, type AppSettings } from "../../shared/settings/index.js";
import { parseLauncherPreferencesPatch, type LauncherPreferences, type LauncherPreferencesPatch } from "../../shared/launcher-contracts.js";
import { AppError } from "../../shared/errors.js";
import { parseSettingsPatch } from "./settings.js";

const KIND = "gwonmac-settings";
const VERSION = 1;

/** Settings that stay on the machine they were made on. */
const NOT_TRANSFERRED: ReadonlySet<keyof AppSettings> = new Set([
  "lastUpdateCheckAt", "compatibilityNoticeSeenFor", "travelShortcuts",
  // The plain game is one Mac's current mode; its masters travel as the ordinary two switches.
  "plainGame",
]);

export type SettingsTransfer = Readonly<{
  settings: AppSettingsPatch;
  launcherContent: NonNullable<LauncherPreferencesPatch["content"]> | null;
  /** Names in the text that this build does not use; they were left out. */
  skipped: readonly string[];
}>;

export function settingsToText(settings: AppSettings, launcherContent: LauncherPreferences["content"]): string {
  const kept = Object.fromEntries(
    (Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[])
      .filter(key => !NOT_TRANSFERRED.has(key))
      .map(key => [key, settings[key]]),
  );
  // With the plain game on, the masters a player chose are the ones it remembers.
  const masters = settings.plainGame ?? {};
  return JSON.stringify({ kind: KIND, version: VERSION, settings: { ...kept, ...masters }, launcherContent }, null, 2);
}

export function settingsFromText(text: string): SettingsTransfer {
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch { throw new AppError("bad_settings", "The text is not copied gwonmac settings."); }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new AppError("bad_settings", "The text is not copied gwonmac settings.");
  const document = raw as Record<string, unknown>;
  if (document.kind !== KIND) throw new AppError("bad_settings", "The text is not copied gwonmac settings.");
  if (document.version !== VERSION) throw new AppError("bad_settings", "These settings come from a version of gwonmac that this one cannot read.");
  const source = document.settings;
  if (!source || typeof source !== "object" || Array.isArray(source)) throw new AppError("bad_settings", "The copied settings are incomplete.");
  const skipped: string[] = [];
  const known: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!Object.hasOwn(DEFAULT_SETTINGS, key) || NOT_TRANSFERRED.has(key as keyof AppSettings)) skipped.push(key);
    else known[key] = value;
  }
  const settings = parseSettingsPatch(known);
  const content = document.launcherContent;
  const launcherContent = content === undefined || content === null
    ? null : parseLauncherPreferencesPatch({ content }).content ?? null;
  return Object.freeze({ settings, launcherContent, skipped: Object.freeze(skipped) });
}
