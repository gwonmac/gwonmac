/**
 * Owns the text form of a player's settings: what Copy settings writes and what Paste
 * settings accepts, so a player can carry their setup to another Mac.
 *
 * The text holds the stored settings and the launcher's Home choices. It carries
 * choices, not the mode: Enable Tools stays as it is on each Mac. It never holds what
 * belongs to one machine or one moment either: the last update check, the client
 * compatibility notice, and the stored Travel shortcuts, which only Travel's own
 * compare-and-refuse path writes. Credentials, accounts, game files and texture packs
 * are not settings, so they are never in the text.
 *
 * Reading is strict about shape and lenient about age. Text that is not copied
 * settings, comes from another format version, or holds a malformed value is refused
 * whole. A name this build does not know (a setting from a newer or older app) is
 * left out and reported, and every value that is kept passes the same validation as
 * the settings file.
 */
import type { AppSettingsPatch } from "../../shared/contracts.js";
import { DEFAULT_SETTINGS, type AppSettings } from "../../shared/settings/index.js";
import {
  LAUNCHER_CONTENT_FIELDS,
  parseLauncherPreferencesPatch,
  type LauncherPreferences,
  type LauncherPreferencesPatch,
  type LauncherSettingsPasteRefusal,
} from "../../shared/launcher-contracts.js";
import { parseSettingsPatch } from "./settings.js";

const KIND = "gwonmac-settings";
const VERSION = 1;
/** Far above any real setup (64 custom map styles included); a larger clipboard is not settings. */
const MAX_TEXT_LENGTH = 4 * 1024 * 1024;

/** Settings that stay on the Mac they were made on. `gwonmacTools` is the launch mode, not a choice. */
const NOT_TRANSFERRED: ReadonlySet<string> = new Set<keyof AppSettings>([
  "gwonmacTools",
  "lastUpdateCheckAt",
  "compatibilityNoticeSeenFor",
  "travelShortcuts",
]);

export type SettingsTransfer = Readonly<{
  settings: AppSettingsPatch;
  launcherContent: NonNullable<LauncherPreferencesPatch["content"]> | null;
  /** Names in the text that this build does not use; they were left out. */
  skipped: readonly string[];
}>;

export type SettingsTransferRead =
  | Readonly<{ ok: true; transfer: SettingsTransfer }>
  | Readonly<{ ok: false; reason: LauncherSettingsPasteRefusal }>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function settingsToText(settings: AppSettings, launcherContent: LauncherPreferences["content"]): string {
  const kept = Object.fromEntries(
    (Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[])
      .filter(key => !NOT_TRANSFERRED.has(key))
      .map(key => [key, settings[key]]),
  );
  return JSON.stringify({ kind: KIND, version: VERSION, settings: kept, launcherContent }, null, 2);
}

export function settingsFromText(text: string): SettingsTransferRead {
  const refuse = (reason: LauncherSettingsPasteRefusal) => Object.freeze({ ok: false as const, reason });
  if (text.length > MAX_TEXT_LENGTH) return refuse("not-settings");
  let document: unknown;
  try { document = JSON.parse(text); }
  catch { return refuse("not-settings"); }
  if (!isRecord(document) || document.kind !== KIND) return refuse("not-settings");
  if (document.version !== VERSION) return refuse("other-version");
  if (!isRecord(document.settings)) return refuse("damaged");

  const skipped: string[] = [];
  const known: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document.settings)) {
    if (Object.hasOwn(DEFAULT_SETTINGS, key) && !NOT_TRANSFERRED.has(key)) known[key] = value;
    else skipped.push(key);
  }
  const content = document.launcherContent ?? null;
  if (content !== null && !isRecord(content)) return refuse("damaged");
  const knownContent: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(content ?? {})) {
    if ((LAUNCHER_CONTENT_FIELDS as readonly string[]).includes(key)) knownContent[key] = value;
    else skipped.push(`launcherContent.${key}`);
  }
  let settings: AppSettingsPatch;
  let launcherContent: SettingsTransfer["launcherContent"];
  try {
    settings = parseSettingsPatch(known);
    launcherContent = content === null ? null : parseLauncherPreferencesPatch({ content: knownContent }).content ?? null;
  } catch {
    return refuse("damaged");
  }
  return Object.freeze({ ok: true as const, transfer: Object.freeze({ settings, launcherContent, skipped: Object.freeze(skipped) }) });
}
