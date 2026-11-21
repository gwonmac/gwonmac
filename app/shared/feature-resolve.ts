/**
 * Decides whether one feature runs, and when it does not, says why in a word the
 * Features tab and the Hub can show a player. Pure: it reads only the feature's
 * manifest (app/features) and one state object, so main, renderer and the Vue apps
 * all get the same answer from the same facts.
 *
 * Reasons are checked in the order FeatureOffReason lists them, and the first that
 * applies wins: what the player can change (a switch, another feature) before what an
 * update changes, before where the character stands. A required feature that is off
 * for a reason the player cannot switch passes that reason on.
 */
import type { Feature } from "../features/index.js";
import type { ClientCompatibility, OptionalFeatureStatus } from "./contracts.js";
import type { EnhancementCapability, EnhancementProgram } from "./enhancement-contracts.js";
import {
  FEATURES,
  featureActivationRequested,
  featureRegionAllowsRequest,
  type FeatureActivationSettings,
  type FeatureId,
} from "./feature-contracts.js";

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

/** Everything `resolve` reads besides the manifest. */
export type FeatureState = Readonly<{
  /** Whether this game session started with Features loaded (not a plain-game Core launch). */
  toolsAtLaunch: boolean;
  /** The saved switches, read live: turning a feature off takes effect at once. */
  settings: Partial<FeatureActivationSettings>;
  /** The developer program; packaged apps always run `none`. */
  program: EnhancementProgram;
  /** Where the character is now, from the certified play-region reader. */
  playRegion: "pve" | "pvp" | "unknown";
  /** The verifier's effective capability statuses for this session; null until it reports. */
  features: ClientCompatibility["features"] | null;
}>;

const ON: FeatureResolution = Object.freeze({ on: true });
const off = (reason: Exclude<FeatureOffReason, "needs">): FeatureResolution => Object.freeze({ on: false, reason });

const byId = new Map<string, Feature>(FEATURES.map((feature) => [feature.id, feature]));

/** The worst status among the capabilities the feature needs: an update outranks a retry. */
function capabilityReason(
  needed: readonly EnhancementCapability[],
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

export function resolve(feature: Feature, state: FeatureState): FeatureResolution {
  const { activation } = feature;
  const programSelects = state.program !== "none"
    && "programs" in feature && feature.programs.some((program) => program === state.program);
  const master = activation.kind === "master" ? activation.setting
    : activation.kind === "setting" ? activation.master : null;
  if (master !== null && !programSelects && state.settings[master] !== true) return off("plain-game");
  if (master !== null && !state.toolsAtLaunch) return off("needs-restart");
  for (const required of "requires" in feature ? feature.requires : []) {
    const requiredFeature = byId.get(required);
    if (requiredFeature === undefined) throw new Error(`unknown required feature ${required}`);
    const resolution = resolve(requiredFeature, state);
    if (resolution.on) continue;
    // "Needs X" asks the player to turn X on; anything else X waits for, this one waits for too.
    if (resolution.reason === "switched-off" || resolution.reason === "needs") {
      return Object.freeze({ on: false, reason: "needs", feature: required });
    }
    return resolution;
  }
  if (!programSelects && !featureActivationRequested(feature.id, state.settings)) return off("switched-off");
  const capability = capabilityReason("capabilities" in feature ? feature.capabilities : [], state.features);
  if (capability !== null) return off(capability);
  if (!featureRegionAllowsRequest(feature.id, state.playRegion)) return off("wrong-area");
  return ON;
}
