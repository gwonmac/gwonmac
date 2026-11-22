/**
 * Static product-feature selection policy, derived from the feature manifests
 * (app/features): each feature's switch by the key rule (docs/settings.md), its region,
 * and the words of its settings. Native capabilities and lifecycle behavior stay in their
 * owning modules until a coordinator can consume those contracts directly.
 */
import type { FeatureDefinition, FeatureSettingText, FeatureSwitchKey, FeatureSwitchMark } from "../features/define.js";
import { FEATURES, type Feature, type FeatureId } from "../features/index.js";
export { FEATURE_KIND_LABELS, FEATURE_PURPOSE_LABELS, type FeaturePurpose } from "../features/define.js";
export { folderForId } from "../features/contract.js";
import type { AppSettings } from "./settings/index.js";

// app/main/core may import only app/shared, so it reaches the manifests here.
export { FEATURES };
export type { FeatureId };

type BooleanSetting = {
  [Key in keyof AppSettings]: AppSettings[Key] extends boolean ? Key : never
}[keyof AppSettings];
/** Every feature switch: the stored booleans resolve reads, under the keys released apps store. */
export type FeatureSwitchSetting = FeatureSwitchKey<Feature>;
const switchesAreBooleans: [FeatureSwitchSetting] extends [BooleanSetting] ? true : never = true;
void switchesAreBooleans;
/** The launch mode's switch (`gwonmacTools`): off is the plain game, which holds every other switch. */
export type LaunchModeSwitch = FeatureSwitchKey<Extract<Feature, Readonly<{ kind: "mode" }>>>;

type FeatureSelectionPolicy = Readonly<{
  /** The feature's own switch; null when it has none and follows the features it requires. */
  switch: FeatureSwitchSetting | null;
  region: FeatureDefinition["region"];
}>;

const definitions: readonly FeatureDefinition[] = FEATURES;
const isSwitch = (spec: object): spec is FeatureSwitchMark => "switch" in spec && spec.switch === true;
/** The key under which a feature's settings declare its switch; the contract allows at most one. */
const switchOf = (feature: FeatureDefinition) => (Object.entries(feature.settings ?? {})
  .find(([, spec]) => isSwitch(spec))?.[0] ?? null) as FeatureSwitchSetting | null;

export const FEATURE_SELECTION_POLICIES = Object.freeze(Object.fromEntries(definitions.map((feature) => [
  feature.id,
  Object.freeze({ switch: switchOf(feature), region: feature.region }),
]))) as Readonly<Record<FeatureId, FeatureSelectionPolicy>>;

const modeFeature = definitions.find((feature) => feature.kind === "mode");
export const LAUNCH_MODE_SWITCH = (modeFeature && switchOf(modeFeature)) as LaunchModeSwitch;
if (!LAUNCH_MODE_SWITCH) throw new Error("the launch mode feature has no switch");

/** A feature's own switch, for a feature that must have one (every tool does). */
export function featureSwitchOf(id: FeatureId): FeatureSwitchSetting {
  const key = FEATURE_SELECTION_POLICIES[id].switch;
  if (key === null) throw new Error(`${id} has no switch of its own`);
  return key;
}

/** A setting some feature owns. */
export type FeatureSettingKey = Feature extends infer Each
  ? Each extends Readonly<{ settings: infer Specs }> ? keyof Specs & string : never
  : never;

/** A card's switch takes the feature's name and summary; every other setting names itself. */
const settingTexts = new Map<string, FeatureSettingText>(definitions.flatMap((feature) =>
  Object.entries(feature.settings ?? {}).map(([key, spec]) => [key, Object.freeze({
    label: spec.label ?? feature.name,
    help: spec.help ?? feature.summary,
  })] as const)));

/** A feature setting's label and help, as its manifest names it: one name everywhere. */
export function featureSettingText(key: FeatureSettingKey): FeatureSettingText {
  const text = settingTexts.get(key);
  if (text === undefined) throw new Error(`${key} is not a feature setting`);
  return text;
}

export type FeatureSwitchSettings = Pick<AppSettings, FeatureSwitchSetting>;

const SWITCH_KEYS: readonly FeatureSwitchSetting[] = definitions.flatMap((feature) => switchOf(feature) ?? []);

/** Only the feature switches, from any settings object: what resolve reads of them. */
export function featureSwitchSettings(settings: Partial<FeatureSwitchSettings>): Partial<FeatureSwitchSettings> {
  return Object.freeze(Object.fromEntries(SWITCH_KEYS.flatMap((key) =>
    settings[key] === undefined ? [] : [[key, settings[key]]])));
}

/**
 * Answers only the coarse region part of feature selection. Feature-owned
 * live-state gates remain authoritative for stronger access checks.
 */
export function featureRegionAllowsRequest(
  id: FeatureId,
  region: "pve" | "pvp" | "unknown",
): boolean {
  const policy = FEATURE_SELECTION_POLICIES[id].region;
  if (policy === "any") return true;
  if (policy === "non-pvp") return region !== "pvp";
  return region === "pve";
}
