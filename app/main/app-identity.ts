/**
 * What this build says about itself: its host version and the distribution
 * channel its package marker declares.
 */
import { app } from "electron";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isDistributionChannel,
  parseDistributionMarker,
  type DistributionChannel,
} from "../shared/distribution-channel.js";

export function readHostVersion(): string {
  try {
    const manifest = JSON.parse(
      readFileSync(path.join(app.getAppPath(), "package.json"), "utf8"),
    ) as unknown;
    if (
      typeof manifest === "object"
      && manifest !== null
      && !Array.isArray(manifest)
    ) {
      const version = (manifest as Record<string, unknown>).version;
      if (typeof version === "string") return version;
    }
  } catch {
    // Electron's answer remains the safe fallback for a broken development
    // checkout. Official packages always carry their package manifest.
  }
  return app.getVersion();
}

export function packagedDistributionChannel(): DistributionChannel | null {
  if (!app.isPackaged) {
    const channel = process.env.GW_TEST_DISTRIBUTION_CHANNEL;
    return isDistributionChannel(channel) ? channel : null;
  }
  if (process.platform !== "darwin") return null;
  try {
    const marker = JSON.parse(
      readFileSync(
        path.join(process.resourcesPath, "distribution-channel.json"),
        "utf8",
      ),
    ) as unknown;
    return parseDistributionMarker(marker)?.channel ?? null;
  } catch {
    return null;
  }
}
