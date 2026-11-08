/**
 * Owns every optional main-process Tools implementation for one Tools-capable
 * launch. Core never imports this module, its stores, or its network client.
 *
 * Each feature's part in MAIN_PARTS owns its stores and channels; this module
 * gives every part its file gate, registers the channels, and drains the gates
 * on every settings change and on disposal.
 */
import { MAIN_PARTS } from "../features/main-parts.js";
import type { BrowserWindow } from "electron";
import type { ClientSession, SettingsResetOutcome } from "../shared/contracts.js";
import type { AppSettings } from "../shared/settings/index.js";
import { featureActivationRequested } from "../shared/feature-contracts.js";
import { AllowlistError } from "../shared/errors.js";
import type { FeatureId } from "../features/index.js";
import type { PreferencesCoordinator } from "./core/preferences-coordinator.js";
import type { MultipleAccountsController } from "./multiple-accounts-controller.js";
import type { GamePaths } from "./paths.js";
import type { WindowRegistry } from "./window-registry.js";
import { register } from "./ipc-channel-registry.js";
import type { AnyToolsMainPart } from "./tools-main-part.js";
import { Mutex } from "./core/mutex.js";

export interface ToolsRuntime {
  applySettings(settings: AppSettings): Promise<void>;
  resetSettings(): Promise<SettingsResetOutcome>;
  dispose(): Promise<void>;
}

export function createToolsRuntime(input: Readonly<{
  paths: GamePaths;
  windows: WindowRegistry;
  accounts: MultipleAccountsController;
  preferences: PreferencesCoordinator;
  initialSettings: AppSettings;
  clientFingerprint(): string | undefined;
  getClientSession(win: BrowserWindow): ClientSession;
}>): ToolsRuntime {
  let settings = input.initialSettings;
  const isFeatureEnabled = (feature: FeatureId): boolean => featureActivationRequested(feature, settings);
  const fileGates: Mutex[] = [];
  const parts: readonly AnyToolsMainPart[] = MAIN_PARTS;
  const sessions = parts.map((part) => {
    const gate = new Mutex();
    fileGates.push(gate);
    const session = part.create({
      paths: input.paths,
      accounts: input.accounts,
      preferences: input.preferences,
      clientFingerprint: input.clientFingerprint,
      getClientSession: input.getClientSession,
      isFeatureEnabled,
      run: (operation) => gate.run(async () => {
        if (!isFeatureEnabled(part.feature)) {
          throw new AllowlistError(`${part.label} is disabled`);
        }
        return operation();
      }),
    });
    register(input.windows, "game", part.contract.channels, session.channels);
    return session;
  });
  const drained = () => Promise.all(fileGates.map((gate) => gate.settled));

  return Object.freeze({
    async applySettings(nextSettings: AppSettings) {
      settings = nextSettings;
      for (const session of sessions) session.applySettings?.(nextSettings);
      await drained();
    },
    resetSettings: () => input.preferences.resetSettings(),
    async dispose() {
      settings = { ...settings, gwonmacTools: false };
      for (const session of sessions) session.dispose?.();
      await drained();
    },
  });
}
