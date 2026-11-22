/**
 * The Features tab's model. Every card comes from a feature's manifest (app/features) and its
 * README.md and CHANGELOG.md; every status comes from resolve (app/shared/feature-resolve.ts).
 * The words for each reason and the switch each card moves are shared with the Hub
 * (app/shared/feature-status.ts). This module adds only what the tab itself decides: how cards
 * group, and the switch changes that turn a feature on together with what it needs.
 */
import type { FeatureDefinition } from "../../../features/define";
import {
  FEATURE_KIND_LABELS,
  FEATURE_PURPOSE_LABELS,
  folderForId,
  type FeatureId,
  type FeatureSettingKey,
} from "@shared/feature-contracts";
import { featureShown, type FeatureState } from "@shared/feature-resolve";
import { featureStatus as sharedStatus, SWITCH_FEATURES, switchOf, type FeatureStatus, type SwitchFeature } from "@shared/feature-status";
import type { GlobalTool, LauncherSnapshot } from "@shared/launcher-contracts";
import { markdownInline, parseMarkdown, type MarkdownBlock, type MarkdownInline } from "@shared/launcher-markdown";
import type { ManifestStage, ReleaseStage } from "@shared/release";
import { featureOptionKeys } from "@shared/settings-catalogue";
import { settingShown } from "@shared/settings/index";
import type { SettingSpec } from "@shared/settings/define";
import { guideLink } from "./guide";

/** A feature with a card: every feature but the launch mode, which is the plain-game strip. */
export type CardFeature = SwitchFeature;
export const CARD_FEATURES: readonly CardFeature[] = SWITCH_FEATURES;
const byId = new Map<FeatureId, CardFeature>(CARD_FEATURES.map((feature) => [feature.id, feature]));
export const cardFeature = (id: FeatureId): CardFeature | undefined => byId.get(id);
/** The cards a build at `stage` shows: a Feature with a later manifest `stage` is not in this release. */
export const cardsAt = (stage: ReleaseStage): readonly CardFeature[] => CARD_FEATURES.filter((feature) => featureShown(feature, stage));

/**
 * The label beside the name of a Feature or option still in development, where the build shows it:
 * "Beta" in Beta and development builds, "Dev" only in development builds.
 */
export const STAGE_LABELS: Readonly<Record<ManifestStage, string>> = { beta: "Beta", dev: "Dev" };
export const featureStageLabel = (feature: CardFeature): string | null => {
  const { stage }: FeatureDefinition = feature;
  return stage === undefined ? null : STAGE_LABELS[stage];
};

/**
 * resolve's state as the launcher sees it: main's facts (app/main/feature-decision.ts), which
 * carry the verifier's statuses for the client build the app serves. The launcher is not a game
 * window: no character stands anywhere (`unknown`, which featureStatus reads as on).
 */
export function launcherFeatureState(facts: LauncherSnapshot["features"]): FeatureState {
  return { ...facts, playRegion: "unknown" };
}

export const REGION_WORDS: Readonly<Record<CardFeature["region"], string>> = { pve: "PvE", "non-pvp": "Outside PvP", any: "Everywhere" };

/** A card's status: the shared reason words (app/shared/feature-status.ts) for the switch it moves. */
export const featureStatus = (feature: CardFeature, state: FeatureState, tools: LauncherSnapshot["tools"]): FeatureStatus =>
  sharedStatus(feature, state, tools.features[switchOf(feature)].enabled);

export type GroupBy = "kind" | "purpose";
export type CardSize = "large" | "compact";
export type FeatureFilter = "all" | "on" | string;

export const groupName = (feature: CardFeature, by: GroupBy) => by === "kind" ? feature.kind : feature.purpose;
export function groupsFor(by: GroupBy): readonly Readonly<{ id: string; name: string }>[] {
  const labels: Readonly<Record<string, string>> = by === "kind" ? FEATURE_KIND_LABELS : FEATURE_PURPOSE_LABELS;
  return Object.entries(labels).map(([id, name]) => ({ id, name }));
}

/** The groups to show, each with its matching cards in a build at `stage`; empty groups are left out. */
export function groupCards(
  by: GroupBy,
  filter: FeatureFilter,
  query: string,
  checked: (feature: CardFeature) => boolean,
  stage: ReleaseStage,
): readonly Readonly<{ id: string; name: string; features: readonly CardFeature[] }>[] {
  const words = query.trim().toLowerCase();
  const matches = (feature: CardFeature) => (filter === "all" || (filter === "on" ? checked(feature) : groupName(feature, by) === filter))
    && (!words || `${feature.name} ${feature.summary}`.toLowerCase().includes(words));
  return groupsFor(by)
    .map((group) => ({ ...group, features: cardsAt(stage).filter((feature) => groupName(feature, by) === group.id && matches(feature)) }))
    .filter((group) => group.features.length > 0);
}

export type SwitchChange = Readonly<{ tool: GlobalTool; enabled: boolean }>;

const readmes = import.meta.glob<string>("../../../features/*/README.md", { query: "?raw", import: "default", eager: true });
const changelogs = import.meta.glob<string>("../../../features/*/CHANGELOG.md", { query: "?raw", import: "default", eager: true });
const fileOf = (files: Readonly<Record<string, string>>, feature: CardFeature, name: string) => files[`../../../features/${folderForId(feature.id)}/${name}`] ?? "";

/**
 * The README in the subset app/features/contract.ts allows. Links reach only www.gwonmac.com,
 * images never show, and Vue renders every block as text.
 */
export const readmeBlocks = (feature: CardFeature, links = true): readonly MarkdownBlock[] =>
  parseMarkdown(fileOf(readmes, feature, "README.md"), { link: (href) => links ? guideLink(href) : null, image: () => null });

export type ChangelogVersion = Readonly<{ version: string; items: readonly (readonly MarkdownInline[])[] }>;

/** The released versions in a CHANGELOG, newest first; `## Unreleased` waits for the release script (plan step 7.2). */
export function parseChangelog(text: string, links = true): readonly ChangelogVersion[] {
  const versions: { version: string; items: (readonly MarkdownInline[])[] }[] = [];
  for (const line of text.split("\n").map((each) => each.trim())) {
    const heading = /^## (.+)$/u.exec(line);
    if (heading) versions.push({ version: heading[1]!, items: [] });
    else if (line.startsWith("- ") && versions.length > 0) versions.at(-1)!.items.push(markdownInline(line.slice(2), { link: (href) => links ? guideLink(href) : null, image: () => null }));
  }
  return versions.filter(({ version, items }) => version !== "Unreleased" && items.length > 0);
}
export const changelogOf = (feature: CardFeature, links = true) => parseChangelog(fileOf(changelogs, feature, "CHANGELOG.md"), links);

/** "New" when this app version brought the feature, "Updated" when it changed it, else nothing. */
export function badgeOf(versions: readonly ChangelogVersion[], appVersion: string): "New" | "Updated" | null {
  if (versions[0]?.version !== appVersion) return null;
  return versions.length === 1 ? "New" : "Updated";
}

/** One option on a Feature page, drawn by its type from the manifest's typed settings. */
export type FeatureOption = Readonly<{
  key: FeatureSettingKey;
  label: string;
  help: string;
  /** The switch this option works under: while it is off, the option is dimmed. */
  dependsOn?: string;
  /** The label beside its name while it is still in development (STAGE_LABELS). */
  stageLabel?: string;
}> & (
  | Readonly<{ kind: "switch" }>
  | Readonly<{ kind: "range"; min: number; max: number; unit: string }>
  | Readonly<{ kind: "choice"; choices: readonly Readonly<{ value: string | number; label: string }>[] }>
  | Readonly<{ kind: "position"; fallback: unknown }>
  /** A value with a control of its own (a map style, colours, keys), drawn by its Feature's control. */
  | Readonly<{ kind: "value" }>
);

/** The options a build at `stage` shows: an option with a later manifest `stage` is not in this release. */
export function featureOptions(feature: CardFeature, stage: ReleaseStage): readonly FeatureOption[] {
  const specs: Readonly<Record<string, SettingSpec<unknown>>> = "settings" in feature ? feature.settings : {};
  return featureOptionKeys(feature).filter((key) => settingShown(key, stage)).map((key): FeatureOption => {
    const spec = specs[key]!;
    const text = { key, label: spec.label ?? key, help: spec.help ?? "", ...(spec.dependsOn ? { dependsOn: spec.dependsOn } : {}),
      ...(spec.stage ? { stageLabel: STAGE_LABELS[spec.stage] } : {}) };
    if (spec.kind === "boolean") return { ...text, kind: "switch" };
    if (spec.kind === "integer" && spec.range) return { ...text, kind: "range", min: spec.range.min, max: spec.range.max, unit: spec.unit ?? "" };
    if (spec.kind === "enum" && spec.values) return { ...text, kind: "choice", choices: spec.values.map((value) => ({ value, label: spec.choices?.[String(value)] ?? String(value) })) };
    if (spec.kind === "position") return { ...text, kind: "position", fallback: spec.fallback };
    return { ...text, kind: "value" };
  });
}
