/**
 * The contract between the Tools runtime and each feature's main-process part
 * (app/features/<id>/main.ts). A part owns its stores and answers every
 * channel of its feature's contract (app/features/<id>/shared/ipc.ts); the
 * runtime gates, registers and waits for them. Adding a feature's channels
 * adds a part to MAIN_PARTS; tools-runtime.ts stays unchanged.
 */
import type { BrowserWindow } from "electron";
import type { FeatureId } from "../features/index.js";
import type { ClientSession } from "../shared/contracts.js";
import type { ChannelTable, ToolContract } from "../shared/ipc/channel-table.js";
import type { ToolsChannels } from "../shared/ipc/tools.js";
import type { AppSettings } from "../shared/settings/index.js";
import type { PreferencesCoordinator } from "./core/preferences-coordinator.js";
import type { Handlers, HandlersPart } from "./ipc-channel-registry.js";
import type { MultipleAccountsController } from "./multiple-accounts-controller.js";
import type { GamePaths } from "./paths.js";

export type ToolsMainInput = Readonly<{
  paths: GamePaths;
  accounts: MultipleAccountsController;
  preferences: PreferencesCoordinator;
  clientFingerprint(): string | undefined;
  getClientSession(win: BrowserWindow): ClientSession;
  /** Whether the current settings select this feature. */
  isFeatureEnabled(feature: FeatureId): boolean;
  /**
   * Runs one operation behind this part's file gate: one at a time, refused
   * with "<label> is disabled" while the feature is off. Every settings change
   * and the runtime's disposal wait for the gate to drain.
   */
  run<Value>(operation: () => Promise<Value>): Promise<Value>;
}>;

export type ToolsMainSession<Channels> = Readonly<{
  channels: Channels;
  /** Called after the runtime adopted new settings, before it waits for the gates. */
  applySettings?(settings: AppSettings): void;
  /** Called after the runtime turned Tools off, before it waits for the gates. */
  dispose?(): void;
}>;

type AnyToolContract = ToolContract<ChannelTable, object>;

/** A feature's part: it answers every channel its contract declares. */
export type ToolsMainPart<Contract extends AnyToolContract> = Readonly<{
  /** The feature whose selection gates this part's operations. */
  feature: FeatureId;
  /** Names the feature in a refused gated operation. */
  label: string;
  contract: Contract;
  create(input: ToolsMainInput): ToolsMainSession<Handlers<Contract["channels"]>>;
}>;

/** Any part, as the runtime gates it and registers its channels as Tools channels. */
export type AnyToolsMainPart = Readonly<{
  feature: FeatureId;
  label: string;
  contract: AnyToolContract;
  create(input: ToolsMainInput): ToolsMainSession<HandlersPart<ToolsChannels>>;
}>;
