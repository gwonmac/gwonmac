/**
 * Defines the bounded in-game settings capability and validates its requests.
 * The existing preferences owner persists changes; launcher administration is excluded.
 */
import { parseGlobalTool, parseLauncherSettingsPatch, type GlobalToolUpdate, type LauncherSettings, type LauncherSnapshot, type ShortcutReplacement, type LauncherShortcutCaptureResult } from './launcher-contracts.js';
import type { ExtendedMemoryRuntimeStatus } from './contracts.js';
import type { SettingsTarget } from './settings-catalogue.js';
import { HUB_SETTINGS } from './settings/index.js';
import { isShortcutBinding, parseShortcutAction, type ShortcutAction } from './keyboard-shortcuts.js';
export const HUB_SETTINGS_FIELDS = HUB_SETTINGS;
/** The settings the game window reads and changes: those of the Settings page's in-game sections. */
export type HubSettings = Pick<LauncherSettings, typeof HUB_SETTINGS_FIELDS[number]>;
export type HubSettingsPatch = Partial<HubSettings>;
export type HubSettingsSnapshot = Pick<LauncherSnapshot, 'tools' | 'shortcuts'> & { settings: HubSettings };
export type HubSettingsChange = { kind: 'settings'; patch: HubSettingsPatch } | { kind: 'tool'; tool: GlobalToolUpdate['tool']; enabled: boolean } | { kind: 'master'; enabled: boolean } | { kind: 'shortcut'; action: ShortcutReplacement['action']; binding: ShortcutReplacement['binding'] };
export interface HubSettingsApi {
  get(): Promise<HubSettingsSnapshot>;
  update(change: HubSettingsChange): Promise<void>;
  capture(action: ShortcutAction): Promise<LauncherShortcutCaptureResult>;
  /** Ends this window's capture, if any; it resolves `cancelled`. */
  cancelCapture(): Promise<void>;
}
export function hubSettingsSnapshot(snapshot: LauncherSnapshot): HubSettingsSnapshot {
  const settings = Object.fromEntries(HUB_SETTINGS_FIELDS.map(key => [key, snapshot.settings[key]])) as HubSettings;
  return { settings, tools: snapshot.tools, shortcuts: snapshot.shortcuts };
}
export function parseHubSettingsChange(value: unknown): HubSettingsChange {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Hub settings change');
  const keys = Object.keys(value);
  const only = (...allowed: string[]) => keys.every(key => allowed.includes(key));
  if ('kind' in value) {
    if (value.kind === 'settings' && only('kind', 'patch') && 'patch' in value && value.patch && typeof value.patch === 'object' && !Array.isArray(value.patch)) {
      if (!Object.keys(value.patch).every(key => HUB_SETTINGS_FIELDS.some(field => field === key))) throw new Error('This setting belongs to the launcher');
      return { kind: 'settings', patch: parseLauncherSettingsPatch(value.patch) };
    }
    if (value.kind === 'master' && only('kind', 'enabled') && 'enabled' in value && typeof value.enabled === 'boolean') return { kind: 'master', enabled: value.enabled };
    if (value.kind === 'tool' && only('kind', 'tool', 'enabled') && 'tool' in value && 'enabled' in value && typeof value.enabled === 'boolean') return { kind: 'tool', tool: parseGlobalTool(value.tool), enabled: value.enabled };
    if (value.kind === 'shortcut' && only('kind', 'action', 'binding') && 'action' in value && 'binding' in value && (value.binding === null || isShortcutBinding(value.binding))) return { kind: 'shortcut', action: parseShortcutAction(value.action), binding: value.binding };
  }
  throw new Error('Invalid Hub settings change');
}

/** The exports of the Hub's Settings module (`app/ui/launcher/src/hub-entry.ts`, built to `settings/settings-app.js`). */
export type EmbeddedSettings<Target> = Readonly<{
  mountSettings(target: Target, options: Readonly<{
    api: HubSettingsApi;
    /** Where to open; `null` reopens the last section. */
    target: SettingsTarget | null;
    /** What this game session's memory module is; the Game section says so beside Extended memory. */
    extendedMemory(): Promise<ExtendedMemoryRuntimeStatus | null>;
    /** Shows a section only the launcher draws, at its control when named. */
    openInLauncher(target: SettingsTarget): void | Promise<unknown>;
    /** Asked once the page has loaded: whether its first open may move the keyboard to it. */
    mayTakeFocus(): boolean;
  }>): Readonly<{
    /** Shows a section, at its control when named, on the page that is already open. */
    open(target: SettingsTarget): void;
    /** Reads settings again after a change saved elsewhere. */
    refresh(): void;
    dispose(): void;
  }>;
}>;
