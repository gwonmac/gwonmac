/**
 * The typed game building blocks that features read: `game.target` and
 * `game.region` (docs/feature-platform-plan.md, Phase 3).
 *
 * A block is one read-only value with a subscription. It wraps a substrate that
 * already exists and owns no memory, so the heap layout and the proofs stay as
 * they are. It never exposes memory, pointers or calls into the game.
 *
 * A block asks the kernel for its data only while someone subscribes, so a
 * feature never states its demand itself: it subscribes when it starts and
 * stops when it stops.
 */
import type { EnhancementCapabilities } from "../shared/enhancement-contracts.js";
import type { CompanionExtensionActivation } from "./certified-companion-extension.js";
import type { CompanionPlayRegionState } from "./companion-play-region-snapshot.js";
import type { CompanionRangeName, CompanionSnapshot } from "./companion-snapshot.js";
import type { ToolsSubstrates } from "./tools-companion-substrates.js";

/** Whether this client build can ever give the block's value. Fixed for one installation. */
export type BlockAvailability =
  | Readonly<{ available: true }>
  /** The verifier did not prove the capability behind the block on this build. */
  | Readonly<{ available: false; reason: "not-proven" }>;

export type Block<Value> = BlockAvailability & Readonly<{
  /**
   * Calls `listener` with the current value at once and again on every change.
   * The returned function stops it; calling it twice is safe.
   */
  subscribe(listener: (value: Value) => void): () => void;
}>;

/** The player's selected target. */
export type GameTarget = Readonly<{
  /** Distance from the player in game units, finite and not negative. */
  distance: number;
  /** The game's range band for that distance. */
  range: TargetRange;
}>;

export type TargetRange = Exclude<CompanionRangeName, "None">;

/** Where the player is. */
export type GameRegion = Readonly<{
  area: "pve" | "pvp";
  instance: "outpost" | "explorable";
  mapId: number;
}>;

export type GameBlocks = Readonly<{
  /** The selected target; null when there is none or the game state is not ready. */
  target: Block<GameTarget | null>;
  /** The current area; null while a map loads, at character select, or when unknown. */
  region: Block<GameRegion | null>;
}>;

type BlockInput = Readonly<{
  capabilities: EnhancementCapabilities;
  observation: ToolsSubstrates["observation"];
  playRegions: CompanionExtensionActivation["playRegions"];
  /** Publishes the active-feature bitmask after a block's demand changed. */
  syncObservers(): void;
}>;

const NOT_PROVEN = Object.freeze({ available: false, reason: "not-proven" } as const);

/**
 * One value with listeners. `demand` runs when the first listener arrives or
 * the last one leaves; a change is published only when `same` says it differs.
 */
function createBlock<Value>(
  available: boolean,
  initial: Value,
  same: (previous: Value, next: Value) => boolean,
  demand: (wanted: boolean) => void,
) {
  const listeners = new Set<(value: Value) => void>();
  let current = initial;
  const block: Block<Value> = Object.freeze({
    ...(available ? { available: true as const } : NOT_PROVEN),
    subscribe(listener: (value: Value) => void) {
      // Each call gets its own entry, so one listener subscribed twice needs two stops.
      // The entry stays quiet until its first call, so a value that `demand` publishes
      // at once reaches this listener exactly once.
      let started = false;
      const entry = (value: Value) => { if (started) listener(value); };
      listeners.add(entry);
      if (available && listeners.size === 1) demand(true);
      started = true;
      listener(current);
      return () => {
        if (!listeners.delete(entry)) return;
        if (available && listeners.size === 0) {
          current = initial;
          demand(false);
        }
      };
    },
  });
  return Object.freeze({
    block,
    get wanted() { return listeners.size > 0; },
    publish(next: Value) {
      if (same(current, next)) return;
      current = next;
      for (const listener of listeners) listener(next);
    },
  });
}

function targetOf(state: CompanionSnapshot): GameTarget | null {
  if (state.status !== "ready" || !state.targetValid || state.rangeName === "None") return null;
  return Object.freeze({ distance: state.distance, range: state.rangeName });
}

const sameTarget = (a: GameTarget | null, b: GameTarget | null) =>
  a === b || (a !== null && b !== null && a.distance === b.distance && a.range === b.range);

function regionOf(state: CompanionPlayRegionState): GameRegion | null {
  if (state.status !== "ready") return null;
  return Object.freeze({
    area: state.playRegion,
    instance: state.instanceType === 0 ? "outpost" : "explorable",
    mapId: state.mapId,
  });
}

const sameRegion = (a: GameRegion | null, b: GameRegion | null) =>
  a === b || (a !== null && b !== null && a.area === b.area && a.instance === b.instance && a.mapId === b.mapId);

export function createGameBlocks({ capabilities, observation, playRegions, syncObservers }: BlockInput): GameBlocks {
  const target = createBlock<GameTarget | null>(capabilities.targetObservation, null, sameTarget, syncObservers);
  if (capabilities.targetObservation) {
    const wanted = () => target.wanted;
    observation.observeStateWhen(wanted);
    observation.observeTargetWhen(wanted);
    observation.onState((state) => { if (target.wanted) target.publish(targetOf(state)); });
  }

  let stopRegion: (() => void) | null = null;
  const region = createBlock<GameRegion | null>(capabilities.playRegionObservation, null, sameRegion, (wanted) => {
    stopRegion?.();
    stopRegion = wanted ? playRegions.subscribe((state) => region.publish(regionOf(state))) : null;
  });

  return Object.freeze({ target: target.block, region: region.block });
}
