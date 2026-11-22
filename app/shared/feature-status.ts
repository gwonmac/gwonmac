/**
 * Owns the words a player reads for why a Feature is off: the reason line for each resolve
 * result (app/shared/feature-resolve.ts) and its look, which the launcher's Features tab and the
 * in-game Hub both show, and the saved switch each Feature moves. Pure: it reads only a manifest,
 * resolve's state and the player's own switch, so every surface gets the same words.
 */
import type { Feature, GlobalTool } from "../features/index.js";
import { BUILD_CHECK_FAILED } from "./contracts.js";
import { FEATURES, FEATURE_SELECTION_POLICIES, type FeatureId } from "./feature-contracts.js";
import { resolve, type FeatureOffReason, type FeatureResolution, type FeatureState } from "./feature-resolve.js";

/** A Feature with a switch of its own: every Feature but the launch mode, which is the plain-game switch. */
export type SwitchFeature = Exclude<Feature, Readonly<{ kind: "mode" }>>;
export const SWITCH_FEATURES: readonly SwitchFeature[] = FEATURES.filter((feature): feature is SwitchFeature => feature.kind !== "mode");

export type ReasonTone = "muted" | "warning";
export type FeatureStatus = Readonly<{
  resolution: FeatureResolution;
  /** The player's own switch, as saved. */
  checked: boolean;
  /** The reason line players read; empty when the feature runs. */
  text: string;
  tone: ReasonTone;
  /**
   * The switch shows the saved choice but cannot change it: only in the plain game, which keeps
   * every choice for when it is turned off (as Settings › Tools does since #44).
   */
  locked: boolean;
  /** The feature to turn on first, for `needs`. */
  needs?: SwitchFeature;
}>;

/**
 * The words and look of each reason (canvas States board; text from the 4.1 table in #39).
 * A player can always turn a Feature off: a build check that failed, changed or has not run yet
 * leaves the switch working, and only the plain game holds the switches.
 */
const REASONS: Readonly<Record<Exclude<FeatureOffReason, "needs" | "wrong-area">, Readonly<{ text: string; tone: ReasonTone; locked: boolean }>>> = {
  "plain-game": { text: "Off while you play the plain game.", tone: "muted", locked: true },
  "needs-restart": { text: "Starts the next time you open Guild Wars.", tone: "warning", locked: false },
  "switched-off": { text: "Off", tone: "muted", locked: false },
  "needs-update": { text: "Needs a GWonMac update for this Guild Wars build.", tone: "muted", locked: false },
  "not-proven": { text: BUILD_CHECK_FAILED, tone: "warning", locked: false },
  checking: { text: "Checking this Guild Wars build…", tone: "warning", locked: false },
};

const byId = new Map<FeatureId, SwitchFeature>(SWITCH_FEATURES.map((feature) => [feature.id, feature]));

/**
 * A Feature's status for a surface that stands in no game area (the launcher, the Hub): resolve
 * tests the area last, so `wrong-area` means only the area is missing, and the Feature reads as
 * on and starts where its region allows. `checked` is the player's own switch.
 */
export function featureStatus(feature: SwitchFeature, state: FeatureState, checked: boolean): FeatureStatus {
  const resolution = resolve(feature, state);
  if (resolution.on || resolution.reason === "wrong-area") return { resolution: { on: true }, checked, text: "", tone: "muted", locked: false };
  // resolve reports the restart before the player's own switch; a switched-off feature will not
  // start after it, so it reads as Off.
  if (resolution.reason === "needs-restart" && !checked) return { resolution: { on: false, reason: "switched-off" }, checked, ...REASONS["switched-off"] };
  if (resolution.reason === "needs") {
    const needs = byId.get(resolution.feature)!;
    return { resolution, checked, text: `Needs ${needs.name}. Turn it on first.`, tone: "warning", locked: false, needs };
  }
  return { resolution, checked, ...REASONS[resolution.reason] };
}

/** Whether a card shows its reason instead of its summary: the player's own Off is the switch itself. */
export const showsReason = (status: FeatureStatus) => !status.resolution.on && status.resolution.reason !== "switched-off";

/** Every feature this one needs, nearest first, each once. */
export function requiredFeatures(feature: SwitchFeature): SwitchFeature[] {
  const found: SwitchFeature[] = [];
  const visit = (each: SwitchFeature) => {
    for (const id of "requires" in each ? each.requires : []) {
      const required = byId.get(id);
      if (required && !found.includes(required)) { found.push(required); visit(required); }
    }
  };
  visit(feature);
  return found;
}

/**
 * The saved switch each Feature moves in Settings › Tools: its own tool's, or for a feature with
 * no switch of its own (Progress, Team Apply), the switch of the feature it runs with.
 */
const toolByFeature = new Map<FeatureId, GlobalTool>(FEATURES.flatMap((feature) => "tool" in feature ? [[feature.id, feature.tool.id] as const] : []));
/** The Feature a switchless one runs with (Progress → Travel), or null when it has its own switch. */
export function runsWith(feature: SwitchFeature): SwitchFeature | null {
  if (toolByFeature.has(feature.id)) return null;
  return requiredFeatures(feature).find((each) => toolByFeature.has(each.id)) ?? null;
}
export function switchOf(feature: SwitchFeature): GlobalTool {
  const tool = [feature, ...requiredFeatures(feature)].map((each) => toolByFeature.get(each.id)).find((each) => each !== undefined);
  if (tool === undefined) throw new Error(`${feature.id} has no switch`);
  return tool;
}

/** Whether the switch a Feature moves (switchOf) is on in the saved settings. */
export function switchedOn(feature: SwitchFeature, settings: FeatureState["settings"]): boolean {
  const owner = [feature, ...requiredFeatures(feature)].find((each) => toolByFeature.has(each.id));
  const key = owner ? FEATURE_SELECTION_POLICIES[owner.id].switch : null;
  return key !== null && settings[key] === true;
}
