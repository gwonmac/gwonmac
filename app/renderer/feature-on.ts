/**
 * Owns this game window's answer to "is this Feature on?" for surfaces that
 * stand in no game area: Hub rows and sources, palettes, commands and the
 * host-only Tools window. It reads main's facts for this window
 * (`window.gwFeatureFacts`, sent by app/main/feature-decision.ts) and asks
 * resolve; the Feature's own part and commands check the area. Every Feature
 * reads off ("checking") until the facts arrive. The harness announces new
 * facts with the `gw:tools-settings` event, as it does new settings.
 */
import type { FeatureId } from "../shared/feature-contracts.js";
import { offWhereAllowed, type FeatureOff } from "../shared/feature-resolve.js";

/** Before main's facts arrive, this window has no check of the build yet. */
const NO_FACTS: FeatureOff = Object.freeze({ on: false, reason: "checking" });

/** Why `id` is off where its region allows, or null while it is on. */
export function featureOff(id: FeatureId): FeatureOff | null {
  const facts = window.gwFeatureFacts?.() ?? null;
  return facts === null ? NO_FACTS : offWhereAllowed(id, facts);
}

export function featureOn(id: FeatureId): boolean {
  return featureOff(id) === null;
}
