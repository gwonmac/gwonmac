/**
 * The narrow, presentation-oriented contract between the unified launcher and
 * Electron main. Domain owners remain in main; this file only names validated
 * commands and the rebuildable projection the Vue application renders.
 */
import { FEATURES, type GlobalTool } from "../features/index.js";
import type {
  AppSettings,
  AppSettingsPatch,
  AppUpdateState,
  CacheInfo,
  ExtendedMemoryRuntimeStatus,
  DownloadActivity,
  FullDownloadState,
  NoticeCode,
} from "./contracts.js";
import type { ErrorCode } from "./errors.js";
import type { MarkdownBlock, MarkdownInline } from "./launcher-markdown.js";
import type { ShortcutAction, ShortcutBinding } from "./keyboard-shortcuts.js";
import { FEATURE_SELECTION_POLICIES, type FeatureId } from "./feature-contracts.js";
import { LAUNCHER_SETTINGS, SETTING_TABLE, type LauncherSetting } from "./settings/index.js";
import { launcherSettingError } from "./settings/define.js";
import type { ProfileId } from "./multiple-accounts.js";
import type { SettingsTarget } from "./settings-catalogue.js";
import type {
  TexturePackImportResult,
  TexturePackSnapshot,
} from "./texture-packs.js";

export const LAUNCHER_IPC = Object.freeze({
  stateGet: "gw:launcher:state:get",
  stateEvent: "gw:launcher:state:event",
  navigationEvent: "gw:launcher:navigation:event",
  profilesCreate: "gw:launcher:profiles:create",
  profilesUpdate: "gw:launcher:profiles:update",
  profilesSetSelection: "gw:launcher:profiles:setSelection",
  profilesPlay: "gw:launcher:profiles:play",
  profilesShow: "gw:launcher:profiles:show",
  profilesCancelQueued: "gw:launcher:profiles:cancelQueued",
  profilesArchive: "gw:launcher:profiles:archive",
  profilesRestore: "gw:launcher:profiles:restore",
  profilesDelete: "gw:launcher:profiles:delete",
  experienceDismissMigration: "gw:launcher:experience:dismissMigration",
  experienceDismissPreferencesReset: "gw:launcher:experience:dismissPreferencesReset",
  experienceCompleteSetup: "gw:launcher:experience:completeSetup",
  experienceUpdatePreferences: "gw:launcher:experience:updatePreferences",
  settingsUpdate: "gw:launcher:settings:update",
  settingsReset: "gw:launcher:settings:reset",
  toolsSetMasterEnabled: "gw:launcher:tools:setMasterEnabled",
  toolsSetFeature: "gw:launcher:tools:setFeature",
  toolsCaptureShortcut: "gw:launcher:tools:captureShortcut",
  toolsReplaceShortcut: "gw:launcher:tools:replaceShortcut",
  toolsRestartToApply: "gw:launcher:tools:restartToApply",
  gameFilesInfo: "gw:launcher:gameFiles:info",
  gameFilesRepair: "gw:launcher:gameFiles:repair",
  gameFilesPauseDownload: "gw:launcher:gameFiles:pauseDownload",
  gameFilesResumeDownload: "gw:launcher:gameFiles:resumeDownload",
  gameFilesResetAndRestart: "gw:launcher:gameFiles:resetAndRestart",
  newsOpen: "gw:launcher:news:open",
  texturePacksImport: "gw:launcher:texturePacks:import",
  texturePacksSelect: "gw:launcher:texturePacks:select",
  texturePacksRemove: "gw:launcher:texturePacks:remove",
  feedbackSend: "gw:launcher:feedback:send",
  externalOpen: "gw:launcher:external:open",
  externalOpenUrl: "gw:launcher:external:openUrl",
  externalRevealLogs: "gw:launcher:external:revealLogs",
  updatesCheck: "gw:launcher:updates:check",
  updatesRestartAndInstall: "gw:launcher:updates:restartAndInstall",
} as const);

/** A launcher page another window can open: `settings` opens the last Settings section; a target opens that section or control. */
export type LauncherDestination = "home" | "accounts" | "settings" | SettingsTarget;

export type LauncherInstallationKind =
  | "fresh"
  | "migrated-single"
  | "migrated-multi"
  | "mixed";

export type LauncherContentKind = "news" | "dailies";

export type LauncherPlayPage = "home" | "accounts";

export function parseLauncherPlayPage(value: unknown): LauncherPlayPage {
  if (value !== "home" && value !== "accounts") throw new Error("launcher play page is invalid");
  return value;
}

export interface LauncherPreferences {
  readonly lastPlayPage?: LauncherPlayPage;
  readonly content: Readonly<{
    news: boolean;
    dailies: boolean;
    first: LauncherContentKind;
    officialNews: boolean;
    reforgedNews: boolean;
    eventNews: boolean;
    autoRotateNews: boolean;
  }>;
}

export type LauncherNewsSource = "game" | "event" | "launcher";
export type LauncherNewsInline = MarkdownInline;
export type LauncherNewsBlock = MarkdownBlock;
export interface LauncherNewsStory {
  readonly id: string;
  readonly source: LauncherNewsSource;
  readonly channel: "all" | "stable" | "beta";
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
  readonly featured: boolean;
  readonly action: "article" | "external";
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly body: readonly LauncherNewsBlock[];
}
export type LauncherNewsState =
  | Readonly<{ status: "loading"; stories: readonly LauncherNewsStory[] }>
  | Readonly<{ status: "ready"; stories: readonly LauncherNewsStory[]; refreshedAt: string }>
  | Readonly<{ status: "offline"; stories: readonly LauncherNewsStory[] }>;

export interface LauncherPreferencesPatch {
  readonly lastPlayPage?: LauncherPlayPage;
  readonly content?: Partial<LauncherPreferences["content"]>;
}

export interface LauncherProfileAppearance {
  readonly icon: string;
  readonly color: string;
}
export const LAUNCHER_PROFILE_ICONS = ["swords", "archive", "map", "scroll", "shield", "star", "crown", "flame"] as const;

export function parseLauncherProfileAppearance(value: unknown): LauncherProfileAppearance {
  const source = exactObject(value, ["icon", "color"], "profile appearance");
  if (typeof source.icon !== "string" || !LAUNCHER_PROFILE_ICONS.includes(source.icon as (typeof LAUNCHER_PROFILE_ICONS)[number])) throw new Error("profile icon is invalid");
  if (typeof source.color !== "string" || !/^#[0-9a-f]{6}$/iu.test(source.color)) throw new Error("profile color is invalid");
  return { icon: source.icon, color: source.color };
}

const toolFeatures = FEATURES.flatMap((feature) => "tool" in feature ? [[feature.tool.id, feature.id] as const] : []);

/** Every feature's switch in Settings › Tools, in FEATURES order. */
export const GLOBAL_TOOLS: readonly GlobalTool[] = Object.freeze(toolFeatures.map(([tool]) => tool));
export type { GlobalTool };
export const GLOBAL_TOOL_FEATURES: Readonly<Record<GlobalTool, FeatureId>> = Object.freeze(Object.fromEntries(toolFeatures) as Record<GlobalTool, FeatureId>);
export const LAUNCHER_EXTERNAL_LINKS = ["github", "bugReport", "featureRequest", "discord", "arenaNetSupport", "donate", "releases"] as const;
export type LauncherExternalLink = (typeof LAUNCHER_EXTERNAL_LINKS)[number];

export interface GlobalToolSetting {
  readonly enabled: boolean;
}

export type GlobalToolSettings = Readonly<Record<GlobalTool, GlobalToolSetting>>;

/** The settings the launcher reads and changes, from the settings table. */
export type LauncherSettings = Readonly<Pick<AppSettings, LauncherSetting>>;

export type LauncherSettingsPatch = Partial<LauncherSettings>;
export interface LauncherProfileUpdate extends LauncherProfileAppearance {
  readonly name: string;
  readonly id: ProfileId;
}
export interface LauncherProfileCreateInput {
  readonly name: string;
  readonly appearance?: LauncherProfileAppearance;
}
export interface GlobalToolUpdate {
  readonly tool: GlobalTool;
  readonly enabled: boolean;
}
export interface ShortcutReplacement {
  readonly action: ShortcutAction;
  readonly binding: ShortcutBinding | null;
}
export type LauncherShortcutCaptureResult =
  | Readonly<{ status: "captured"; binding: ShortcutBinding }>
  /** `owner: "hub"` is Command-R while the Hub uses it (HUB-095). */
  | Readonly<{ status: "reserved"; owner?: "hub" }>
  | Readonly<{ status: "conflict"; action: ShortcutAction; binding: ShortcutBinding }>
  | Readonly<{ status: "cleared" }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "invalid" }>;

export interface LauncherProfileSummary {
  readonly id: ProfileId;
  readonly name: string;
  readonly archived: boolean;
  readonly state: "ready" | "queued" | "opening" | "checking" | "running" | "failed";
  readonly appearance: LauncherProfileAppearance;
  readonly failure?: "profile-preparation" | "window-startup" | "client-validation" | "renderer-crash" | "unknown";
}

export type LauncherBackgroundDownload =
  | (Extract<FullDownloadState, { readonly status: "running" }> & Readonly<Pick<
      DownloadActivity,
      "received" | "total" | "bytesPerSecond" | "secondsRemaining"
    >>)
  | Exclude<FullDownloadState, { readonly status: "running" }>;

export type LauncherReadiness =
  | { readonly state: "preparing"; readonly progress: DownloadActivity }
  | {
      readonly state: "playable";
      readonly backgroundDownload: LauncherBackgroundDownload | null;
      readonly notice?: NoticeCode;
    }
  | { readonly state: "repair-required"; readonly reason: ErrorCode }
  | { readonly state: "offline-playable" };

export interface LauncherSnapshot {
  readonly revision: number;
  readonly experience: Readonly<{
    installationKind: LauncherInstallationKind;
    setup: "pending" | "complete";
    showMigrationNotice: boolean;
    preferencesReset: boolean;
  }>;
  readonly readiness: LauncherReadiness;
  readonly appUpdate: AppUpdateState;
  readonly tools: Readonly<{
    configured: boolean;
    loaded: boolean;
    restartRequired: boolean;
    features: GlobalToolSettings;
  }>;
  readonly settings: LauncherSettings;
  readonly shortcuts: Readonly<Record<ShortcutAction, ShortcutBinding | null>>;
  readonly texturePacks: TexturePackSnapshot;
  /** The running client's memory limit; null until a client is prepared. */
  readonly extendedMemory: ExtendedMemoryRuntimeStatus | null;
  readonly profiles: readonly LauncherProfileSummary[];
  readonly selectedProfileIds: readonly ProfileId[];
  readonly preferences: LauncherPreferences;
  readonly news: LauncherNewsState;
}

export interface LauncherNativeApi {
  readonly navigation: {
    onRequest(callback: (destination: LauncherDestination) => void): () => void;
  };
  readonly state: {
    get(): Promise<LauncherSnapshot>;
    onChange(callback: (snapshot: LauncherSnapshot) => void): () => void;
  };
  readonly profiles: {
    create(input: LauncherProfileCreateInput): Promise<void>;
    update(input: LauncherProfileUpdate): Promise<void>;
    setSelection(ids: readonly ProfileId[]): Promise<void>;
    play(ids: readonly ProfileId[]): Promise<void>;
    show(id: ProfileId): Promise<void>;
    cancelQueued(ids: readonly ProfileId[]): Promise<void>;
    archive(id: ProfileId): Promise<void>;
    restore(id: ProfileId): Promise<void>;
    delete(id: ProfileId): Promise<void>;
  };
  readonly experience: {
    completeSetup(input: { readonly enableTools: boolean }): Promise<void>;
    dismissMigrationNotice(): Promise<void>;
    dismissPreferencesReset(): Promise<void>;
    updatePreferences(patch: LauncherPreferencesPatch): Promise<void>;
  };
  readonly news: {
    open(id: string): Promise<void>;
  };
  readonly settings: {
    update(patch: LauncherSettingsPatch): Promise<void>;
    reset(): Promise<void>;
  };
  readonly tools: {
    setMasterEnabled(enabled: boolean): Promise<void>;
    setFeature(input: GlobalToolUpdate): Promise<void>;
    captureShortcut(action: ShortcutAction): Promise<LauncherShortcutCaptureResult>;
    replaceShortcut(input: ShortcutReplacement): Promise<void>;
    restartToApply(): Promise<void>;
  };
  readonly gameFiles: {
    info(): Promise<CacheInfo>;
    repair(): Promise<void>;
    pauseDownload(): Promise<void>;
    resumeDownload(): Promise<void>;
    resetAndRestart(): Promise<void>;
  };
  readonly texturePacks: {
    import(): Promise<TexturePackImportResult>;
    select(id: string | null): Promise<void>;
    remove(id: string): Promise<void>;
  };
  readonly updates: {
    check(): Promise<void>;
    restartAndInstall(): Promise<void>;
  };
  readonly feedback: {
    send(input: LauncherFeedback): Promise<void>;
  };
  readonly external: {
    open(kind: LauncherExternalLink): Promise<void>;
    /** A web page the bundled Guide links to; main opens only the origins in LAUNCHER_GUIDE_ORIGINS. */
    openUrl(url: string): Promise<void>;
    revealLogs(): Promise<void>;
  };
}

export const LAUNCHER_FEEDBACK_KINDS = ["problem", "idea", "other"] as const;
export type LauncherFeedbackKind = (typeof LAUNCHER_FEEDBACK_KINDS)[number];
export const LAUNCHER_FEEDBACK_MESSAGE_LIMIT = 4000;

/** What a player chose to send. The main process adds only version facts. */
export interface LauncherFeedback {
  readonly kind: LauncherFeedbackKind;
  readonly message: string;
  /** Present only when the player asked for an answer. */
  readonly email?: string;
}

export function parseLauncherFeedback(value: unknown): LauncherFeedback {
  const source = exactObject(value, ["kind", "message", "email"], "feedback");
  if (typeof source.kind !== "string" || !LAUNCHER_FEEDBACK_KINDS.includes(source.kind as LauncherFeedbackKind)) throw new Error("feedback kind is invalid");
  const kind = source.kind as LauncherFeedbackKind;
  if (typeof source.message !== "string") throw new Error("feedback message is invalid");
  const message = source.message.trim();
  if (!message || message.length > LAUNCHER_FEEDBACK_MESSAGE_LIMIT) throw new Error("feedback message is invalid");
  if (source.email === undefined) return { kind, message };
  if (typeof source.email !== "string") throw new Error("feedback email is invalid");
  const email = source.email.trim();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) throw new Error("feedback email is invalid");
  return { kind, message, email };
}

export function parseGlobalTool(value: unknown): GlobalTool {
  if (typeof value === "string" && GLOBAL_TOOLS.includes(value as GlobalTool)) return value as GlobalTool;
  throw new Error("Tool is invalid");
}

export function parseLauncherExternalLink(value: unknown): LauncherExternalLink {
  if (typeof value === "string" && LAUNCHER_EXTERNAL_LINKS.includes(value as LauncherExternalLink)) return value as LauncherExternalLink;
  throw new Error("external link is invalid");
}

/** The sites the bundled Guide may open in the browser. The Guide is built into the app, so this is the whole list. */
export const LAUNCHER_GUIDE_ORIGINS: ReadonlySet<string> = new Set([
  "https://www.gwonmac.com",
  "https://github.com",
  "https://discord.gg",
  "https://wiki.guildwars.com",
  "https://help.guildwars.com",
  "https://account.arena.net",
]);

export function parseLauncherGuideUrl(value: unknown): string {
  if (typeof value === "string" && value.length <= 512) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password && LAUNCHER_GUIDE_ORIGINS.has(url.origin)) return url.href;
    } catch { /* falls through */ }
  }
  throw new Error("guide link is invalid");
}

export function parseLauncherNewsId(value: unknown): string {
  if (typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/u.test(value)) return value;
  throw new Error("news id is invalid");
}

/** Each field reads as its setting does in the settings file; only the refusal is worded for the launcher. */
export function parseLauncherSettingsPatch(value: unknown): LauncherSettingsPatch {
  const source = exactObject(value, LAUNCHER_SETTINGS, "launcher settings patch");
  const result: Record<string, unknown> = {};
  for (const key of LAUNCHER_SETTINGS) {
    if (source[key] === undefined) continue;
    const spec = SETTING_TABLE.get(key)!;
    const parsed = spec.read(source[key]);
    if (parsed === undefined) throw new Error(launcherSettingError(key, spec));
    result[key] = parsed;
  }
  return result as LauncherSettingsPatch;
}

/** The launcher's view of `settings`. */
export function launcherSettings(settings: AppSettings): LauncherSettings {
  return Object.fromEntries(LAUNCHER_SETTINGS.map((key) => [key, settings[key]])) as LauncherSettings;
}

/** Each tool's switch, read from the setting that activates its feature. */
export function launcherToolSettings(settings: AppSettings): GlobalToolSettings {
  return Object.freeze(Object.fromEntries(GLOBAL_TOOLS.map((tool) => [tool, Object.freeze({
    enabled: settings[FEATURE_SELECTION_POLICIES[GLOBAL_TOOL_FEATURES[tool]].activation.setting],
  })]))) as GlobalToolSettings;
}

export function globalToolPatch(tool: GlobalTool, enabled: boolean): AppSettingsPatch {
  return { [FEATURE_SELECTION_POLICIES[GLOBAL_TOOL_FEATURES[tool]].activation.setting]: enabled };
}

function exactObject(value: unknown, allowed: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !allowed.includes(key))) throw new Error(`${label} has an unknown field`);
  return source;
}

export function parseLauncherPreferencesPatch(value: unknown): LauncherPreferencesPatch {
  const source = exactObject(value, ["content", "lastPlayPage"], "launcher preferences patch");
  const page = source.lastPlayPage === undefined ? {} : { lastPlayPage: parseLauncherPlayPage(source.lastPlayPage) };
  if (source.content === undefined) return page;
  const content = exactObject(
    source.content,
    ["news", "dailies", "first", "officialNews", "reforgedNews", "eventNews", "autoRotateNews"],
    "launcher content patch",
  );
  const patch: {
    news?: boolean;
    dailies?: boolean;
    first?: LauncherContentKind;
    officialNews?: boolean;
    reforgedNews?: boolean;
    eventNews?: boolean;
    autoRotateNews?: boolean;
  } = {};
  for (const field of ["news", "dailies", "officialNews", "reforgedNews", "eventNews", "autoRotateNews"] as const) {
    const candidate = content[field];
    if (candidate === undefined) continue;
    if (typeof candidate !== "boolean") throw new Error(`${field} must be a boolean`);
    patch[field] = candidate;
  }
  if (content.first !== undefined) {
    if (content.first !== "news" && content.first !== "dailies") throw new Error("first content must be news or dailies");
    patch.first = content.first;
  }
  return { ...page, content: patch };
}
