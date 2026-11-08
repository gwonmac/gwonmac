/**
 * The launcher window's channels and what each validated request does, grouped
 * by the owner it acts on: accounts, first-run experience, settings and Tools,
 * game files, texture packs, links and support, and app updates. Every
 * LAUNCHER_CHANNELS entry has exactly one owner, or this file does not compile.
 * The launcher preload exposes this vocabulary; game preloads never receive it.
 */
import { app, dialog, net, shell as electronShell, type BrowserWindow } from "electron";
import { writeFile } from "node:fs/promises";
import type { ClientRuntime } from "../client/client-runtime.js";
import { EXTERNAL_URLS } from "../shared/contracts.js";
import type { InvokeKey } from "../shared/ipc/channel-table.js";
import type { LauncherChannels } from "../shared/ipc/launcher.js";
import { parseShortcutAction } from "../shared/keyboard-shortcuts.js";
import {
  parseGlobalToolUpdate,
  parseLauncherExternalLink,
  parseLauncherFeedback,
  parseLauncherGuideUrl,
  parseLauncherNewsId,
  parseLauncherPreferencesPatch,
  parseLauncherProfileAppearance,
  parseLauncherSettingsPatch,
  parseShortcutReplacement,
  type LauncherProfileCreateInput,
  type LauncherProfileUpdate,
} from "../shared/launcher-contracts.js";
import { parseProfileId, parseProfileName } from "../shared/multiple-accounts.js";
import type { AppSettings } from "../shared/settings/index.js";
import { parseTexturePackId } from "../shared/texture-packs.js";
import { parseProfileIds } from "./accounts-ipc-values.js";
import type { AppShell } from "./app-shell.js";
import { sendLauncherFeedback } from "./core/launcher-feedback.js";
import type { LauncherNewsService } from "./core/launcher-news.js";
import type { LauncherStateStore } from "./core/launcher-state.js";
import { allGlobalToolsPatch } from "./core/launcher-tools.js";
import type { TexturePackManager } from "./core/texture-pack-manager.js";
import { logEvent } from "./diagnostics.js";
import { channel, ownedOnce, register, type HandlersPart } from "./ipc-channel-registry.js";
import { nothing, one } from "./ipc-values.js";
import type { LauncherOrchestrator } from "./launcher-orchestrator.js";
import { captureLauncherShortcut } from "./launcher-shortcut-capture.js";
import type { MultipleAccountsController } from "./multiple-accounts-controller.js";
import type { GamePaths } from "./paths.js";
import type { ToolsRuntime } from "./tools-runtime.js";
import type { UpdaterService } from "./updater-service.js";
import { windowRegistry } from "./window-registry.js";

export type LauncherIpcInput = Readonly<{
  shell: AppShell;
  paths: GamePaths;
  hostVersion: string;
  settings: AppSettings;
  accounts: MultipleAccountsController;
  launcherState: LauncherStateStore;
  launcherNews: LauncherNewsService;
  texturePacks: TexturePackManager;
  clientRuntime: ClientRuntime;
  updater: UpdaterService;
  toolsRuntime: ToolsRuntime | null;
  orchestrator: LauncherOrchestrator;
}>;

type LauncherHandlers = HandlersPart<LauncherChannels>;

const profileIds = one(parseProfileIds);
const profileId = one(parseProfileId);
const profileCreate = one((value: unknown): LauncherProfileCreateInput => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("profile request must be an object");
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !["name", "appearance"].includes(key))) throw new Error("profile request has an unknown field");
  const name = parseProfileName(source.name);
  if (source.appearance === undefined) return { name };
  return { name, appearance: parseLauncherProfileAppearance(source.appearance) };
});
const booleanValue = one((value: unknown): boolean => {
  if (typeof value !== "boolean") throw new Error("value must be a boolean");
  return value;
});
const nullableTexturePackId = one((value: unknown): string | null =>
  value === null ? null : parseTexturePackId(value));
const setup = one((value: unknown): { readonly enableTools: boolean } => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("setup request must be an object");
  const source = value as Record<string, unknown>;
  if (Object.keys(source).length !== 1 || typeof source.enableTools !== "boolean") throw new Error("setup request is invalid");
  return { enableTools: source.enableTools };
});
const profileUpdate = one((value: unknown): LauncherProfileUpdate => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("profile update must be an object");
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some((key) => !["id", "name", "icon", "color"].includes(key))) throw new Error("profile update has an unknown field");
  const id = parseProfileId(source.id);
  const name = parseProfileName(source.name);
  const appearance = parseLauncherProfileAppearance({ icon: source.icon, color: source.color });
  return { id, name, ...appearance };
});

function relaunch(): void {
  app.relaunch();
  app.quit();
}

/** The launcher's projection and the account profiles it manages. */
function profiles({ accounts, launcherNews, orchestrator }: LauncherIpcInput) {
  const connected = new WeakSet<BrowserWindow>();
  return {
    channels: {
      stateGet: channel(nothing, (win) => {
        if (!connected.has(win)) {
          connected.add(win);
          logEvent({ k: "launcher.connected" });
          void launcherNews.refresh().then(() => orchestrator.publish());
        }
        return orchestrator.snapshot();
      }),
      profilesCreate: channel(profileCreate, async (_win, { name, appearance }) => {
        const previousIds = new Set(accounts.state().profiles.map((profile) => profile.id));
        const next = await accounts.create({ name });
        const created = next.profiles.find((profile) => !previousIds.has(profile.id));
        if (!created) throw new Error("Created account was not published");
        if (appearance) await orchestrator.updateAppearance(created.id, appearance);
      }),
      profilesUpdate: channel(profileUpdate, async (_win, { id, name, icon, color }) => {
        await accounts.rename(id, name);
        await orchestrator.updateAppearance(id, { icon, color });
      }),
      profilesSetSelection: channel(profileIds, (_win, ids) => orchestrator.setSelection(ids)),
      profilesPlay: channel(profileIds, (_win, ids) => orchestrator.play(ids)),
      profilesShow: channel(profileId, (_win, id) => orchestrator.show(id)),
      profilesCancelQueued: channel(profileIds, (_win, ids) => orchestrator.cancel(ids)),
      profilesArchive: channel(profileId, async (_win, id) => {
        await accounts.archive(id);
      }),
      profilesRestore: channel(profileId, async (_win, id) => {
        await accounts.restore(id);
      }),
      profilesDelete: channel(profileId, async (win, id) => {
        await accounts.delete(win, id);
      }),
    } satisfies LauncherHandlers,
  };
}

/** First-run setup, one-time notices, and the launcher's own presentation. */
function experience({ shell, orchestrator }: LauncherIpcInput) {
  return {
    channels: {
      experienceDismissMigration: channel(nothing, () => orchestrator.dismissMigrationNotice()),
      experienceDismissPreferencesReset: channel(nothing, () => orchestrator.dismissPreferencesReset()),
      experienceCompleteSetup: channel(setup, async (_win, { enableTools }) => {
        if (enableTools) {
          await shell.preferences.write({ kind: "settings", patch: allGlobalToolsPatch(true) });
        }
        await orchestrator.completeSetup();
        if (enableTools) relaunch();
      }),
      experienceUpdatePreferences: channel(one(parseLauncherPreferencesPatch), (_win, patch) =>
        orchestrator.updatePreferences(patch)),
    } satisfies LauncherHandlers,
  };
}

/** Settings, Tools and shortcut writes, and the confirmed reset. */
function settings(input: LauncherIpcInput) {
  const { shell, orchestrator, toolsRuntime, launcherState, texturePacks } = input;
  const { preferences } = shell;
  const currentSettings = () => shell.currentSettings() ?? input.settings;
  return {
    channels: {
      settingsUpdate: channel(one(parseLauncherSettingsPatch), async (_win, patch) => {
        await preferences.write({ kind: "settings", patch });
      }),
      settingsReset: channel(nothing, async (win) => {
        const { response } = await dialog.showMessageBox(win, {
          type: "warning",
          buttons: ["Reset Settings", "Cancel"],
          defaultId: 1,
          cancelId: 1,
          message: "Reset all app settings?",
          detail: "This resets launcher and game preferences, Tools, shortcuts, custom map styles, and custom panel colors. Original textures will be selected. Accounts, saved logins, game files, imported texture packs, builds, templates, screenshots, and chat logs are kept.",
        });
        if (response !== 0) return;
        await (toolsRuntime?.resetSettings() ?? preferences.resetCoreSettings());
        await launcherState.resetPresentation();
        await texturePacks.select(null);
        logEvent({ k: "settings.reset" });
        orchestrator.publish();
      }),
      toolsSetMasterEnabled: channel(booleanValue, async (_win, enabled) => {
        await preferences.write({ kind: "master", enabled });
      }),
      toolsSetFeature: channel(one(parseGlobalToolUpdate), async (_win, update) => {
        await preferences.write({ kind: "tool", ...update });
      }),
      toolsCaptureShortcut: channel(one(parseShortcutAction), (win, action) =>
        captureLauncherShortcut(win, action, currentSettings)),
      toolsReplaceShortcut: channel(one(parseShortcutReplacement), async (_win, replacement) => {
        await preferences.write({ kind: "shortcut", ...replacement });
      }),
      toolsRestartToApply: channel(nothing, () => {
        if (windowRegistry.gameWindows().length > 0) return;
        relaunch();
      }),
    } satisfies LauncherHandlers,
  };
}

/** The shared game files: their size, repair, the full download, and reset. */
function gameFiles({ clientRuntime, paths }: LauncherIpcInput) {
  return {
    channels: {
      gameFilesInfo: channel(nothing, () => clientRuntime.cacheInfo()),
      gameFilesRepair: channel(nothing, async (win) => {
        if (windowRegistry.gameWindows().length > 0) {
          await dialog.showMessageBox(win, {
            type: "info",
            buttons: ["OK"],
            message: "Close your game windows first",
            detail: "Open games stay usable. Repair can start after every account is closed.",
          });
          return;
        }
        await clientRuntime.retryClient(relaunch);
      }),
      gameFilesPauseDownload: channel(nothing, () => clientRuntime.stopDownload()),
      gameFilesResumeDownload: channel(nothing, async () => {
        await clientRuntime.downloadAll();
      }),
      gameFilesResetAndRestart: channel(nothing, async (win) => {
        const { response } = await dialog.showMessageBox(win, {
          type: "warning",
          buttons: ["Reset and Redownload", "Cancel"],
          defaultId: 1,
          cancelId: 1,
          message: "Reset and redownload game files?",
          detail: "Accounts, saved logins, settings, Tools, shortcuts, builds, templates, screenshots, and chat logs are kept.",
        });
        if (response !== 0) return;
        await writeFile(paths.cacheClearRequest, "launcher-full-reset-v1", { mode: 0o600 });
        relaunch();
      }),
    } satisfies LauncherHandlers,
  };
}

/** Imported texture packs, with the native file picker and confirmation. */
function texturePackChannels({ texturePacks }: LauncherIpcInput) {
  return {
    channels: {
      texturePacksImport: channel(nothing, async (win) => {
        const result = await dialog.showOpenDialog(win, {
          title: "Import Texture Pack",
          properties: ["openFile"],
          filters: [{ name: "TexMod texture packs", extensions: ["tpf"] }],
        });
        if (result.canceled || result.filePaths.length !== 1) return { status: "cancelled" as const };
        return texturePacks.importFile(result.filePaths[0]!);
      }),
      texturePacksSelect: channel(nullableTexturePackId, (_win, id) => texturePacks.select(id)),
      texturePacksRemove: channel(one(parseTexturePackId), async (win, id) => {
        const pack = texturePacks.snapshot().packs.find((candidate) => candidate.id === id);
        if (!pack) throw new Error("Texture pack is not installed");
        const { response } = await dialog.showMessageBox(win, {
          type: "warning",
          buttons: ["Remove", "Cancel"],
          defaultId: 1,
          cancelId: 1,
          message: `Remove ${pack.name}?`,
          detail: "The managed copy is deleted. Game windows that are already open keep their current appearance until they close.",
        });
        if (response === 0) await texturePacks.remove(id);
      }),
    } satisfies LauncherHandlers,
  };
}

/** News, feedback, external pages, and the logs folder. */
function links({ launcherNews, paths, hostVersion }: LauncherIpcInput) {
  let feedbackInFlight = false;
  return {
    channels: {
      newsOpen: channel(one(parseLauncherNewsId), (_win, id) => launcherNews.open(id)),
      feedbackSend: channel(one(parseLauncherFeedback), async (_win, feedback) => {
        // One report at a time: a second click must not post the same text twice.
        if (feedbackInFlight) throw new Error("feedback is already being sent");
        feedbackInFlight = true;
        try {
          await sendLauncherFeedback((url, init) => net.fetch(url, init), feedback, {
            appVersion: hostVersion,
            macosVersion: process.getSystemVersion(),
          });
        } finally {
          feedbackInFlight = false;
        }
      }),
      externalOpen: channel(one(parseLauncherExternalLink), async (_win, kind) => {
        await electronShell.openExternal(EXTERNAL_URLS[kind]);
      }),
      externalOpenUrl: channel(one(parseLauncherGuideUrl), (_win, url) => electronShell.openExternal(url)),
      externalRevealLogs: channel(nothing, () => electronShell.showItemInFolder(paths.diagnostics)),
    } satisfies LauncherHandlers,
  };
}

/** The application update check and install. */
function updates({ updater }: LauncherIpcInput) {
  return {
    channels: {
      updatesCheck: channel(nothing, () => updater.check()),
      updatesRestartAndInstall: channel(nothing, (win) => updater.restartAndInstall(win)),
    } satisfies LauncherHandlers,
  };
}

export function registerLauncherIpc(input: LauncherIpcInput): void {
  const parts = ownedOnce<InvokeKey<LauncherChannels>>()([
    profiles(input),
    experience(input),
    settings(input),
    gameFiles(input),
    texturePackChannels(input),
    links(input),
    updates(input),
  ]);
  for (const part of parts) register(windowRegistry, "launcher", part.channels);
}
