/**
 * Owns which Features draw with the map engine in this folder: every Feature that uses the
 * certified Cartography stage (Exploration grid, this folder's own manifest, and the map Features
 * whose manifests say so). The engine (renderer host and game part) runs while any of them is on.
 * They share the stage and the PvE region, so while the engine runs, each layer draws exactly
 * while its Feature's switch (a stored layer key) is on.
 */
import { FEATURES, type FeatureId } from "../../index.js";

export const MAP_FEATURES: readonly FeatureId[] = FEATURES
  .filter((feature) => "uses" in feature && (feature.uses as readonly string[]).includes("cartography"))
  .map((feature) => feature.id);

/** Whether any map Feature is on, by the given answer for one Feature. */
export const anyMapFeatureOn = (on: (id: FeatureId) => boolean): boolean => MAP_FEATURES.some(on);
