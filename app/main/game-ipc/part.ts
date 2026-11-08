/**
 * The contract between the game window's Core channel owners and their
 * registration (register.ts): what an owner may use, and what it returns.
 * Each owner returns the channels it answers, typed against GAME_CHANNELS,
 * the way a Tool's main part does (tools-main-part.ts).
 */
import type { GameChannels } from "../../shared/ipc/game.js";
import type { AppSettings } from "../../shared/settings/index.js";
import type { ClientService } from "../client-service.js";
import type { PreferencesCoordinator } from "../core/preferences-coordinator.js";
import type { SocketManager } from "../core/sockets.js";
import type { HandlersPart } from "../ipc-channel-registry.js";
import type { LauncherOrchestrator } from "../launcher-orchestrator.js";
import type { MultipleAccountsController } from "../multiple-accounts-controller.js";
import type { GamePaths } from "../paths.js";
import type { WindowHost } from "../window.js";
import type { WindowRegistry } from "../window-registry.js";

export type GameIpcInput = Readonly<{
  paths: GamePaths;
  windows: WindowRegistry;
  sockets: SocketManager;
  accounts: MultipleAccountsController;
  client: ClientService;
  preferences: PreferencesCoordinator;
  host: WindowHost;
  launcher: LauncherOrchestrator;
  currentSettings: () => AppSettings;
}>;

/** Any subset of the Core game channels, each typed against its table entry. */
export type GameHandlers = HandlersPart<GameChannels>;
