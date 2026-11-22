/**
 * Decides whether one feature runs, and when it does not, says why in a word the
 * Features tab and the Hub can show a player. Pure: it reads only the feature's
 * manifest (app/features) and one state object, so main, renderer and the Vue apps
 * all get the same answer from the same facts. This is the only on/off decision:
 * main gathers the facts (app/main/feature-decision.ts) and sends them to the
 * launcher and every game window, which add only where the character stands.
 *
 * Reasons are checked in the order FeatureOffReason lists them, and the first that
 * applies wins: whether the Feature is in this release at all, then what the player can
 * change (a switch, another feature) before what an update changes, before where the
 * character stands. A required feature that is off
 * for a reason the player cannot switch passes that reason on.
 */
import type { FeatureDefinition } from "../features/define.js";
import type { Feature } from "../features/index.js";
import type { ClientCompatibility, FeatureUse, OptionalFeatureStatus } from "./contracts.js";
import { capabilityRecord, type EnhancementProgram } from "./enhancement-contracts.js";
import {
  FEATURES,
  FEATURE_SELECTION_POLICIES,
  LAUNCH_MODE_SWITCH,
  featureRegionAllowsRequest,
  type FeatureSwitchSettings,
  type FeatureId,
} from "./feature-contracts.js";
import { shownAt, type ReleaseStage } from "./release.js";

/** A required feature must be a known feature id. */
type RequiredFeature = Extract<Feature, { requires: unknown }>["requires"][number];
const requiresNameFeatures: [RequiredFeature] extends [FeatureId] ? true : never = true;
void requiresNameFeatures;

/**
 * Why a feature does not run. The names are stable: the Features tab and the Hub map each
 * one to player text, so add one only for a new thing a player can do or wait for.
 */
export type FeatureOffReason =
  /**
   * The Feature's manifest `stage` is later than this build's (app/shared/release.ts): it is
   * not in this release. No player sees this reason: every surface leaves such a Feature out.
   */
  | "not-in-release"
  /**
   * The player plays the plain game (`gwonmacTools` off): every Feature is off and its own
   * switch waits as stored. Player text: "Off while you play the plain game."
   */
  | "plain-game"
  /** Optional features were turned on after the game started; they load at the next start. */
  | "needs-restart"
  /** Another feature this one builds on is not running (`feature` names it). */
  | "needs"
  /** The feature's own switch is off. */
  | "switched-off"
  /** This Guild Wars build changed what the feature relies on; a GWonMac update brings it back. */
  | "needs-update"
  /** GWonMac could not check or start what the feature relies on; it tries again at next start. */
  | "not-proven"
  /** The game's check of this build has not reported yet. */
  | "checking"
  /** The feature does not run where the character is now (PvP, or not in a map yet). */
  | "wrong-area";

export type FeatureResolution =
  | Readonly<{ on: true }>
  | Readonly<{ on: false; reason: Exclude<FeatureOffReason, "needs"> }>
  | Readonly<{ on: false; reason: "needs"; feature: FeatureId }>;

/** resolve's answer for a feature that does not run: its reason, and for `needs` the feature to turn on. */
export type FeatureOff = Extract<FeatureResolution, Readonly<{ on: false }>>;

/** Everything `resolve` reads besides the manifest. */
export type FeatureState = Readonly<{
  /** The stage this build shows (app/shared/release.ts); main derives it once at startup. */
  stage: ReleaseStage;
  /** Whether this game session started with Features loaded (not a plain-game Core launch). */
  toolsAtLaunch: boolean;
  /** The saved switches, read live: turning a feature off takes effect at once. */
  settings: Partial<FeatureSwitchSettings>;
  /** The developer program; packaged apps always run `none`. */
  program: EnhancementProgram;
  /** Where the character is now, from the certified play-region reader. */
  playRegion: "pve" | "pvp" | "unknown";
  /** The verifier's effective capability statuses for this session; null until it reports. */
  features: ClientCompatibility["features"] | null;
}>;

/**
 * The facts main knows and sends (app/main/feature-decision.ts): everything resolve reads but
 * where the character stands, which only a game window knows.
 */
export type FeatureFacts = Omit<FeatureState, "playRegion">;

/**
 * Verifier statuses with every capability proved, for the places that leave the build out of the
 * decision on purpose: the unpackaged Electron test seam (app/main/feature-decision.ts) and the
 * selection view in app/renderer/enhancement-runtime-policy.ts.
 */
export const EVERY_CAPABILITY_PROVED: NonNullable<FeatureState["features"]> = Object.freeze({
  gameFileSaving: { status: "available" },
  nativeDoubleClick: { status: "available" },
  cartography: { status: "available" },
  ...capabilityRecord(() => ({ status: "available" as const })),
});

const ON: FeatureResolution = Object.freeze({ on: true });
const off = (reason: Exclude<FeatureOffReason, "needs">): FeatureResolution => Object.freeze({ on: false, reason });

const byId = new Map<string, Feature>(FEATURES.map((feature) => [feature.id, feature]));
const featureOf = (id: FeatureId): Feature => {
  const feature = byId.get(id);
  if (feature === undefined) throw new Error(`unknown feature ${id}`);
  return feature;
};

/** The worst status among the capabilities the feature needs: an update outranks a retry. */
function capabilityReason(
  needed: readonly FeatureUse[],
  features: FeatureState["features"],
): "needs-update" | "not-proven" | "checking" | null {
  if (needed.length === 0) return null;
  if (features === null) return "checking";
  const statuses: OptionalFeatureStatus[] = needed.map((capability) => features[capability]);
  if (statuses.some((status) => status.status === "unavailable" && status.reason === "game-update")) {
    return "needs-update";
  }
  // "off" means this launch did not ask for the capability (a developer program or the
  // official-client diagnostic profile); a player launch with features loaded asks for all.
  return statuses.every((status) => status.status === "available") ? null : "not-proven";
}

/** Whether a Feature is in this build's release at all (its manifest `stage`). */
export const featureShown = (feature: FeatureDefinition, stage: ReleaseStage): boolean => shownAt(feature.stage, stage);

export function resolve(feature: Feature, state: FeatureState): FeatureResolution {
  if (!featureShown(feature, state.stage)) return off("not-in-release");
  const programSelects = state.program !== "none"
    && "programs" in feature && feature.programs.some((program) => program === state.program);
  if (!programSelects && state.settings[LAUNCH_MODE_SWITCH] !== true) return off("plain-game");
  if (!state.toolsAtLaunch) return off("needs-restart");
  for (const required of "requires" in feature ? feature.requires : []) {
    const resolution = resolve(featureOf(required), state);
    if (resolution.on) continue;
    // "Needs X" asks the player to turn X on; anything else X waits for, this one waits for too.
    if (resolution.reason === "switched-off" || resolution.reason === "needs") {
      return Object.freeze({ on: false, reason: "needs", feature: required });
    }
    return resolution;
  }
  // The plain-game switch was checked above, so only the feature's own switch is left; a feature
  // without one runs while the features it requires run.
  const own = FEATURE_SELECTION_POLICIES[feature.id].switch;
  if (own !== null && !programSelects && state.settings[own] !== true) return off("switched-off");
  const capability = capabilityReason("uses" in feature ? feature.uses : [], state.features);
  if (capability !== null) return off(capability);
  if (!featureRegionAllowsRequest(feature.id, state.playRegion)) return off("wrong-area");
  return ON;
}

/** resolve for a feature named by its id. */
export const resolveFeature = (id: FeatureId, state: FeatureState): FeatureResolution => resolve(featureOf(id), state);

/**
 * Whether a feature is on once the character stands where its region allows. Surfaces that stand
 * in no game area (the launcher, menus, shortcuts, Hub rows, palettes) show and run a feature by
 * this; the feature's own part and commands check the area. resolve tests the area last, so
 * `wrong-area` means only the area is missing.
 */
export function onWhereAllowed(id: FeatureId, facts: FeatureFacts): boolean {
  return offWhereAllowed(id, facts) === null;
}

/** Why a feature is off even where its region allows (onWhereAllowed), or null when it is on there. */
export function offWhereAllowed(id: FeatureId, facts: FeatureFacts): FeatureOff | null {
  const resolution = resolveFeature(id, { ...facts, playRegion: "unknown" });
  return resolution.on || resolution.reason === "wrong-area" ? null : resolution;
}
