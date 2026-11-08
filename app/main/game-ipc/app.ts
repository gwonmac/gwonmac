/**
 * The game window's app channels: external links and Finder, the launcher and
 * its Settings, quit and reload, the relog intent, and the Hub's account list.
 */
import { shell } from "electron";
import {
  EXTERNAL_URLS,
  GAME_RELOAD_CAUSES,
  type ExternalLinkKind,
  type GameReloadCause,
  type RevealKind,
} from "../../shared/contracts.js";
import { ValidationError } from "../../shared/errors.js";
import { parseSettingsTarget, type SettingsTarget } from "../../shared/settings-catalogue.js";
import { parseHubAccountRequest } from "../accounts-ipc-values.js";
import { activateHubAccount, hubAccountSnapshot } from "../hub-account-actions.js";
import { channel } from "../ipc-channel-registry.js";
import { nothing, one, type Parser } from "../ipc-values.js";
import { closeProfileWindow, requestGameQuit } from "../window.js";
import { showQuitOrReloadGame } from "../window-menu.js";
import type { GameHandlers, GameIpcInput } from "./part.js";

const asGameReloadCause = one((value: unknown): GameReloadCause => {
  if (!GAME_RELOAD_CAUSES.includes(value as GameReloadCause)) {
    throw new ValidationError("unknown game reload cause");
  }
  return value as GameReloadCause;
});

const asRevealKind = one((value: unknown): RevealKind => {
  if (value !== "gameData") {
    throw new ValidationError("invalid reveal kind");
  }
  return value;
});

const asExternalLinkKind = one((value: unknown): ExternalLinkKind => {
  if (
    value !== "github" &&
    value !== "bugReport" &&
    value !== "featureRequest" &&
    value !== "discord" &&
    value !== "arenaNetSupport" &&
    value !== "donate" &&
    value !== "releases" &&
    value !== "store" &&
    value !== "kamadanTrade" &&
    value !== "preSearingTrade"
  ) {
    throw new ValidationError("invalid external link kind");
  }
  return value;
});

/** No argument opens the last Settings section; one names a section or control. */
const asOptionalSettingsTarget: Parser<[target?: SettingsTarget]> = (values) =>
  values.length === 0 ? [] : one(parseSettingsTarget)(values);

export default ({ paths, windows, host }: GameIpcInput) => ({
  channels: {
    appOpenExternal: channel(asExternalLinkKind, async (_win, kind) => {
      await shell.openExternal(EXTERNAL_URLS[kind]);
    }),
    // The renderer names an intent; only main knows the path, and no path is
    // answered back.
    appRevealPath: channel(asRevealKind, (_win, kind) => {
      if (kind === "gameData") shell.showItemInFolder(paths.game);
    }),
    appShowLauncher: channel(nothing, () => {
      host.revealLauncher();
    }),
    appOpenSettings: channel(asOptionalSettingsTarget, (_win, target) => {
      host.revealLauncher(target ?? "settings");
    }),
    appRequestQuit: channel(nothing, (win) => requestGameQuit(win)),
    // The Hub's "Quit or Reload Game…" opens the same sheet as Command-Q (HUB-001).
    appShowQuitOrReload: channel(nothing, (win) => showQuitOrReloadGame(host, win)),
    appReloadGame: channel(asGameReloadCause, (win, cause) => host.reloadGame(win, cause)),
    appClaimRelogIntent: channel(nothing, (win) => host.claimRelogIntent(win)),
    hubAccountsGet: channel(nothing, (win) =>
      hubAccountSnapshot(host.accounts, windows.profileForGameWindow(win))),
    hubAccountOpen: channel(one(parseHubAccountRequest), (win, request) =>
      activateHubAccount(host.accounts, windows.profileForGameWindow(win), request, async () => {
        await closeProfileWindow(win);
        if (!win.isDestroyed()) throw new Error("The other account is open. This account stayed open because closing was cancelled.");
      })),
  } satisfies GameHandlers,
});
