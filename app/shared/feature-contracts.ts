/**
 * Static product-feature selection policy, derived from the feature manifests
 * (app/features). Native capabilities and lifecycle behavior stay in their
 * owning modules until a coordinator can consume those contracts directly.
 */
import type { FeatureDefinition, FeatureSettingText } from "../features/define.js";
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
type ActivationSetting = Feature["activation"]["setting"] | Extract<Feature["activation"], { master: string }>["master"];
/** Every setting that selects a feature must be a stored boolean. */
const activationSettingsAreBooleans: [ActivationSetting] extends [BooleanSetting] ? true : never = true;
void activationSettingsAreBooleans;
type FeatureBooleanSetting = ActivationSetting & BooleanSetting;

type FeatureActivation =
  | Readonly<{ kind: "master"; setting: FeatureBooleanSetting }>
  | Readonly<{ kind: "setting"; setting: FeatureBooleanSetting; master: FeatureBooleanSetting }>;

type FeatureSelectionPolicy = Readonly<{
  activation: FeatureActivation;
  region: FeatureDefinition["region"];
}>;

const definitions: readonly FeatureDefinition[] = FEATURES;
export const FEATURE_SELECTION_POLICIES = Object.freeze(Object.fromEntries(definitions.map((feature) => [
  feature.id,
  Object.freeze({ activation: Object.freeze({ ...feature.activation }), region: feature.region }),
]))) as Readonly<Record<FeatureId, FeatureSelectionPolicy>>;

/** A setting some feature owns. */
export type FeatureSettingKey = Feature extends infer Each
  ? Each extends Readonly<{ settings: infer Specs }> ? keyof Specs & string : never
  : never;

const settingTexts = new Map<string, FeatureSettingText>(definitions.flatMap((feature) =>
  Object.entries(feature.settings ?? {}).map(([key, { label, help }]) => [key, Object.freeze({ label, help })] as const)));

/** A feature setting's label and help, as its manifest names it: one name everywhere. */
export function featureSettingText(key: FeatureSettingKey): FeatureSettingText {
  const text = settingTexts.get(key);
  if (text === undefined) throw new Error(`${key} is not a feature setting`);
  return text;
}

export type FeatureActivationSettings = Pick<
  AppSettings,
  FeatureBooleanSetting
>;

export function featureActivationRequested(
  id: FeatureId,
  settings: Partial<FeatureActivationSettings>,
): boolean {
  const activation = FEATURE_SELECTION_POLICIES[id].activation;
  if (activation.kind !== "setting") return settings[activation.setting] === true;
  if (!settings[activation.master]) return false;
  return settings[activation.setting] === true;
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
