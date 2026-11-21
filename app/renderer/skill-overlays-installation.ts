/**
 * The skill HUD substrate: the certified slot-geometry and recharge feeds, and
 * which of them run. Native ownership stays in the feed installations.
 *
 * A feed runs while something needs it: the slot geometry for Skill Key Labels
 * (still drawn here until it moves onto blocks) or for the `ui.skillLabels`
 * block, and the recharge feed for the `game.skillbar` block (game-blocks.ts).
 */
import type { NativeHudLayer } from "./native-hud-layer.js";
import { COMPANION_FEATURE_BITS } from "../shared/companion-abi.js";
import type { AppSettings } from "../shared/settings/index.js";
import type { EnhancementCapabilities } from "../shared/enhancement-contracts.js";
import { createSkillCooldownObservationInstallation } from "./skill-cooldown-state-installation.js";
import { createSkillKeyOverlayConsumer } from "./skill-key-overlay-consumer.js";
import { createSkillSlotGeometryInstallation } from "./skill-slot-geometry-installation.js";

type SkillSettings = Pick<AppSettings, "skillKeyBindings">;

export function createSkillOverlaysInstallation(
  capabilities: Pick<EnhancementCapabilities, "skillSlotGeometry" | "skillCooldownObservation" | "nativeHudRendering">,
) {
  const geometry = createSkillSlotGeometryInstallation(capabilities.skillSlotGeometry);
  const cooldowns = createSkillCooldownObservationInstallation(
    capabilities.skillCooldownObservation,
  );
  let keyConsumer: ReturnType<typeof createSkillKeyOverlayConsumer> | null = null;
  let unsubscribeKeyGeometry: (() => void) | null = null;
  let keyLabels = false;
  let slotsWanted = false;
  let cooldownsWanted = false;
  let activeFeatureFlags = 0;

  const apply = () => {
    const geometryActive = capabilities.nativeHudRendering && (keyLabels || slotsWanted);
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
    mount(parent: HTMLElement, hud: NativeHudLayer) {
      if (!capabilities.nativeHudRendering || !capabilities.skillSlotGeometry || keyConsumer !== null) return;
      const canvas = parent.ownerDocument.getElementById("canvas");
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error("Enhancement skill overlay target is missing");
      }
      keyConsumer = createSkillKeyOverlayConsumer(parent, canvas, hud);
      unsubscribeKeyGeometry = geometry.subscribe(keyConsumer.update);
    },
    /** Applies Skill Key Labels' switch and bindings. */
    sync(settings: SkillSettings, skillKeyLabels: boolean) {
      keyLabels = skillKeyLabels;
      apply();
      keyConsumer?.setBindings(settings.skillKeyBindings);
      keyConsumer?.setEnabled(skillKeyLabels);
    },
    disposePresentation() {
      const failures: unknown[] = [];
      const attempt = (release: (() => void) | null) => {
        try { release?.(); } catch (cause) { failures.push(cause); }
      };
      const keyToDispose = keyConsumer;
      const releases = [
        unsubscribeKeyGeometry,
        keyToDispose === null ? null : () => keyToDispose.dispose(),
      ];
      unsubscribeKeyGeometry = null;
      keyConsumer = null;
      for (const release of releases) attempt(release);
      if (failures.length > 0) {
        throw new AggregateError(failures, "Skill overlay cleanup failed");
      }
    },
  });
}

export type SkillOverlays = ReturnType<typeof createSkillOverlaysInstallation>;
