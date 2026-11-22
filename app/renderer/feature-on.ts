/**
 * Owns this game window's answer to "is this Feature on?" for surfaces that
 * stand in no game area: Hub rows and sources, palettes, commands and the
 * host-only Tools window. It reads main's facts for this window
 * (`window.gwFeatureFacts`, sent by app/main/feature-decision.ts) and asks
 * resolve; the Feature's own part and commands check the area. Every Feature
 * reads off until the facts arrive. The harness announces new facts with the
 * `gw:tools-settings` event, as it does new settings.
 */
import type { FeatureId } from "../shared/feature-contracts.js";
import { onWhereAllowed } from "../shared/feature-resolve.js";

export function featureOn(id: FeatureId): boolean {
  const facts = window.gwFeatureFacts?.() ?? null;
  return facts !== null && onWhereAllowed(id, facts);
}
