/**
 * What Maps' companion part hands the Maps stage: the certified player location,
 * kept private to renderer consumers, and a reader of the live play region.
 *
 * The Maps stage starts at WASM instantiation, outside the companion parts
 * contract and before (or without) a certified companion, so it cannot be given
 * the policy source when it is created. The part connects its own
 * `context.playRegion` reader on activation and disconnects it with its
 * presentation; no copy of the region is kept. Without a connected reader the
 * region is unknown, and a PvE-only Maps stays hidden.
 * The developer-facing companion global remains unavailable in player mode.
 */
import type { CompanionSnapshot } from "../../../renderer/companion-snapshot.js";
import type { RuntimePlayRegion } from "../../../renderer/enhancement-runtime-policy.js";

let current: CompanionSnapshot | null = null;
let playRegion: (() => RuntimePlayRegion) | null = null;

export function readCartographyPlayerState(): CompanionSnapshot | null {
  return current;
}

export function updateCartographyPlayerState(state: CompanionSnapshot): void {
  current = state;
}

export function readCartographyPlayRegion(): RuntimePlayRegion {
  return playRegion?.() ?? "unknown";
}

export function connectCartographyPlayRegion(reader: () => RuntimePlayRegion): void {
  playRegion = reader;
}

export function clearCartographyPlayerState(): void {
  current = null;
  playRegion = null;
}
