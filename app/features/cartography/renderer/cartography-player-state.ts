/**
 * What Maps' companion part hands the Maps stage: the certified player location,
 * kept private to renderer consumers, and the live play region from the same
 * policy source every other feature reads. Until the part publishes, the region
 * is unknown, and a PvE-only Maps stays hidden.
 * The developer-facing companion global remains unavailable in player mode.
 */
import type { CompanionSnapshot } from "../../../renderer/companion-snapshot.js";
import type { RuntimePlayRegion } from "../../../renderer/enhancement-runtime-policy.js";

let current: CompanionSnapshot | null = null;
let playRegion: RuntimePlayRegion = "unknown";

export function readCartographyPlayerState(): CompanionSnapshot | null {
  return current;
}

export function updateCartographyPlayerState(state: CompanionSnapshot): void {
  current = state;
}

export function readCartographyPlayRegion(): RuntimePlayRegion {
  return playRegion;
}

export function updateCartographyPlayRegion(region: RuntimePlayRegion): void {
  playRegion = region;
}

export function clearCartographyPlayerState(): void {
  current = null;
  playRegion = "unknown";
}
