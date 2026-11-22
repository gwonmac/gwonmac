/**
 * The contract between the Tools runtime and each feature's main-process part
 * (app/features/<id>/main.ts). A part owns its stores and answers every
 * channel of its feature's contract (app/features/<id>/shared/ipc.ts); the
 * runtime gates, registers and waits for them. Adding a feature's channels
 * adds a part to MAIN_PARTS; tools-runtime.ts stays unchanged. `mainPart` builds
 * one in the `start → stop` shape every part kind shares (app/features/parts.ts).
 */
import type { BrowserWindow } from "electron";
import type { FeatureId } from "../features/index.js";
import type { PartOwner, RunningPart } from "../features/parts.js";
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
  /** Whether the Feature decision (app/main/feature-decision.ts) has this feature on now. */
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

/**
 * The `main` kind of app/features/parts.ts, for a feature whose manifest lists "main". `create`
 * builds its stores and answers every channel of its contract: the channels stay registered
 * and the file gate refuses them while the feature is off. `start` runs while the Feature
 * decision has the feature on; what it returns is stopped when the decision turns it off and
 * when Tools stops.
 */
export function mainPart<Contract extends AnyToolContract, Running extends RunningPart>(part: Readonly<{
  feature: PartOwner<"main">;
  label: string;
  contract: Contract;
  create(input: ToolsMainInput): Readonly<{ channels: Handlers<Contract["channels"]>; start(): Running }>;
}>): ToolsMainPart<Contract> {
  return Object.freeze({
    feature: part.feature,
    label: part.label,
    contract: part.contract,
    create(input: ToolsMainInput) {
      const { channels, start } = part.create(input);
      let running: Running | null = null;
      const stop = () => {
        const stopping = running;
        running = null;
        stopping?.stop();
      };
      const sync = () => {
        if (input.isFeatureEnabled(part.feature)) running ??= start();
        else stop();
      };
      sync();
      return { channels, applySettings: sync, dispose: stop };
    },
  });
}

/** Any part, as the runtime gates it and registers its channels as Tools channels. */
export type AnyToolsMainPart = Readonly<{
  feature: FeatureId;
  label: string;
  contract: AnyToolContract;
  create(input: ToolsMainInput): ToolsMainSession<HandlersPart<ToolsChannels>>;
}>;
