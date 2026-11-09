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
 *
 * Progress's part also hands over the active quest's marker, so the walking
 * route can lead to it. The marker is in the game units of the map the
 * Progress snapshot was read on; Maps uses it only in that map.
 */
import type { CompanionSnapshot } from "../../../renderer/companion-snapshot.js";
import type { RuntimePlayRegion } from "../../../renderer/enhancement-runtime-policy.js";
import type { GameProgressState } from "../../../shared/game-progress.js";

/** Where the client points for the active quest, on the map the player was in. */
export type CartographyQuestMarker = Readonly<{ mapId: number; x: number; y: number }>;

let current: CompanionSnapshot | null = null;
let playRegion: (() => RuntimePlayRegion) | null = null;
let quest: CartographyQuestMarker | null = null;

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

export function readCartographyQuestMarker(): CartographyQuestMarker | null {
  return quest;
}

/** Keeps the marker of a ready Progress state; any other state has none. */
export function updateCartographyQuest(state: GameProgressState): void {
  const marker = state.status === "ready" ? state.quest?.marker : undefined;
  quest = state.status === "ready" && marker ? Object.freeze({ mapId: state.mapId, ...marker }) : null;
}

export function clearCartographyPlayerState(): void {
  current = null;
  playRegion = null;
  quest = null;
}
