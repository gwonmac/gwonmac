/**
 * The skill HUD substrate: the certified slot-geometry and recharge feeds, and
 * which of them run. Native ownership stays in the feed installations.
 *
 * A feed runs while a block needs it: the slot geometry while `ui.skillLabels` or
 * `ui.skillKeys` draws, and the recharge feed while `game.skillbar` is read
 * (game-blocks.ts).
 */
import { COMPANION_FEATURE_BITS } from "../shared/companion-abi.js";
import type { EnhancementCapabilities } from "../shared/enhancement-contracts.js";
import { createSkillCooldownObservationInstallation } from "./skill-cooldown-state-installation.js";
import { createSkillSlotGeometryInstallation } from "./skill-slot-geometry-installation.js";

export function createSkillOverlaysInstallation(
  capabilities: Pick<EnhancementCapabilities, "skillSlotGeometry" | "skillCooldownObservation" | "nativeHudRendering">,
) {
  const geometry = createSkillSlotGeometryInstallation(capabilities.skillSlotGeometry);
  const cooldowns = createSkillCooldownObservationInstallation(
    capabilities.skillCooldownObservation,
  );
  let slotsWanted = false;
  let cooldownsWanted = false;
  let activeFeatureFlags = 0;

  const apply = () => {
    const geometryActive = capabilities.nativeHudRendering && slotsWanted;
    geometry.setActive(geometryActive);
    cooldowns.setActive(cooldownsWanted);
    activeFeatureFlags = (capabilities.skillSlotGeometry && geometryActive ? COMPANION_FEATURE_BITS.skillSlotGeometry : 0)
      | (capabilities.skillCooldownObservation && cooldownsWanted ? COMPANION_FEATURE_BITS.skillCooldownObservation : 0);
  };

  return Object.freeze({
    geometry,
    cooldowns,
    certifiedFeatureFlags:
      (capabilities.skillSlotGeometry ? COMPANION_FEATURE_BITS.skillSlotGeometry : 0)
      | (capabilities.skillCooldownObservation
        ? COMPANION_FEATURE_BITS.skillCooldownObservation
        : 0),
    get activeFeatureFlags() { return activeFeatureFlags; },
    /** The slot geometry runs while a block draws on the skill slots. */
    wantSlots(wanted: boolean) { slotsWanted = wanted; apply(); },
    /** The recharge feed runs while a block reads it. */
    wantCooldowns(wanted: boolean) { cooldownsWanted = wanted; apply(); },
  });
}

export type SkillOverlays = ReturnType<typeof createSkillOverlaysInstallation>;
