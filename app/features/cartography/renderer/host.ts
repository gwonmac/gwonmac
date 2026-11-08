/**
 * Maps' one entry for the game host. The harness calls it once after the
 * official client is instantiated; from then on it follows the Maps switch.
 *
 * Maps is not a companion part: its certified hooks come with every Tools
 * launch (the separate cartography stage), whether or not a companion manifest
 * is certified, so it installs straight from the instantiated exports.
 */
import type { ToolsGwNativeApi } from "../../../shared/contracts.js";
import type { AppSettings } from "../../../shared/settings/index.js";
import { featureActivationRequested } from "../../../shared/feature-contracts.js";
import { createCartographyLifecycle } from "./cartography-lifecycle.js";

export type { CartographyGridStats, CartographyModelStats, CompassRangeStats } from "./overlay.js";

export type CartographyHost = Readonly<{
  /** Reads the settings again; Maps installs or withdraws to match its switch. */
  update(): void;
  dispose(): void;
}>;

export function installCartographyHost(options: Readonly<{
  exports: WebAssembly.Exports;
  parent: HTMLElement;
  canvas: HTMLCanvasElement;
  api: Pick<ToolsGwNativeApi, "cartography" | "settings">;
  /** The settings the window applied last; null until the first ones arrive. */
  settings(): AppSettings | null;
  reportFailure(error: unknown): void;
}>): CartographyHost {
  const { api } = options;
  const settings = () => {
    const current = options.settings();
    if (current === null) throw new Error("cartography installed before settings");
    return current;
  };
  const lifecycle = createCartographyLifecycle(async () => {
    const { installCartography } = await import("./cartography-installation.js");
    return installCartography({
      exports: options.exports,
      parent: options.parent,
      canvas: options.canvas,
      settings,
      persist: (patch) => api.settings.set(patch),
      exportEvidence: (capture) => api.cartography.exportEvidence(capture),
      getMapKnowledge: (kernelSha256) => api.cartography.getMapKnowledge(kernelSha256),
      recordMapKnowledge: (value) => api.cartography.recordMapKnowledge(value),
    });
  }, options.reportFailure);
  return Object.freeze({
    update() {
      const current = options.settings();
      lifecycle.update(current !== null && featureActivationRequested("cartography", current));
    },
    dispose: lifecycle.dispose,
  });
}
