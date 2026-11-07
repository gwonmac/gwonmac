/**
 * The contract between the Tools runtime and each feature's main-process part
 * (app/features/<id>/main.ts). A part owns its stores and returns its IPC
 * channels; the runtime gates, registers and waits for them. Adding a feature's
 * channels adds a part to MAIN_PARTS; tools-runtime.ts and tools-ipc.ts stay
 * unchanged.
 */
import type { BrowserWindow } from "electron";
import type { FeatureId } from "../features/index.js";
import type { AppSettings, ClientSession, ToolsInvokeChannel } from "../shared/contracts.js";
import { ValidationError } from "../shared/errors.js";
import type { PreferencesCoordinator } from "./core/preferences-coordinator.js";
import type { AnyChannelDef, Parser } from "./ipc-channel-registry.js";
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

export type ToolsMainSession = Readonly<{
  channels: Partial<Record<ToolsInvokeChannel, AnyChannelDef>>;
  /** Called after the runtime adopted new settings, before it waits for the gates. */
  applySettings?(settings: AppSettings): void;
  /** Called after the runtime turned Tools off, before it waits for the gates. */
  dispose?(): void;
}>;

export type ToolsMainPart = Readonly<{
  /** The feature whose selection gates this part's operations. */
  feature: FeatureId;
  /** Names the feature in a refused gated operation. */
  label: string;
  create(input: ToolsMainInput): ToolsMainSession;
}>;

export const nothing: Parser<void> = (args) => {
  if (args.length !== 0) throw new ValidationError("expected 0 IPC arguments");
};

export const one = <Input>(parse: (value: unknown) => Input): Parser<Input> => (args) => {
  if (args.length !== 1) throw new ValidationError("expected 1 IPC argument");
  return parse(args[0]);
};
