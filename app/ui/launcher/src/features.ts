/**
 * The Features tab's model. Every card comes from a feature's manifest (app/features) and its
 * README.md and CHANGELOG.md; every status comes from resolve (app/shared/feature-resolve.ts).
 * The words for each reason and the switch each card moves are shared with the Hub
 * (app/shared/feature-status.ts). This module adds only what the tab itself decides: how cards
 * group, and the switch changes that turn a feature on together with what it needs.
 */
import {
  FEATURE_KIND_LABELS,
  FEATURE_SELECTION_POLICIES,
  FEATURE_PURPOSE_LABELS,
  folderForId,
  type FeatureId,
} from "@shared/feature-contracts";
import type { FeatureState } from "@shared/feature-resolve";
import { featureStatus as sharedStatus, requiredFeatures, SWITCH_FEATURES, switchOf, type FeatureStatus, type SwitchFeature } from "@shared/feature-status";
import type { GlobalTool, LauncherSnapshot } from "@shared/launcher-contracts";
import { markdownInline, parseMarkdown, type MarkdownBlock, type MarkdownInline } from "@shared/launcher-markdown";
import { SETTINGS, type SettingsTarget } from "@shared/settings-catalogue";
import { LAUNCHER_SETTINGS, type LauncherSetting } from "@shared/settings/index";
import { guideLink } from "./guide";

/** A feature with a card: every feature but the launch mode, which is the plain-game strip. */
export type CardFeature = SwitchFeature;
export const CARD_FEATURES: readonly CardFeature[] = SWITCH_FEATURES;
const byId = new Map<FeatureId, CardFeature>(CARD_FEATURES.map((feature) => [feature.id, feature]));
export const cardFeature = (id: FeatureId): CardFeature | undefined => byId.get(id);

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

/** The groups to show, each with its matching cards; empty groups are left out. */
export function groupCards(
  by: GroupBy,
  filter: FeatureFilter,
  query: string,
  checked: (feature: CardFeature) => boolean,
): readonly Readonly<{ id: string; name: string; features: readonly CardFeature[] }>[] {
  const words = query.trim().toLowerCase();
  const matches = (feature: CardFeature) => (filter === "all" || (filter === "on" ? checked(feature) : groupName(feature, by) === filter))
    && (!words || `${feature.name} ${feature.summary}`.toLowerCase().includes(words));
  return groupsFor(by)
    .map((group) => ({ ...group, features: CARD_FEATURES.filter((feature) => groupName(feature, by) === group.id && matches(feature)) }))
    .filter((group) => group.features.length > 0);
}

export type SwitchChange = Readonly<{ tool: GlobalTool; enabled: boolean }>;

/**
 * Turning a feature on turns on what it needs. `alsoOn` names the needed features whose switch
 * was off, for the notice that offers Undo; `changes` are the switches to move, each once.
 */
export function turnOnChanges(feature: CardFeature, tools: LauncherSnapshot["tools"]): Readonly<{ changes: readonly SwitchChange[]; alsoOn: readonly CardFeature[] }> {
  const off = (each: CardFeature) => !tools.features[switchOf(each)].enabled;
  const required = requiredFeatures(feature);
  const switches = [...new Set([feature, ...required].filter(off).map(switchOf))];
  return { changes: switches.map((tool) => ({ tool, enabled: true })), alsoOn: required.filter(off) };
}

/** "Progress is on. Travel is on too, because Progress needs it." */
export function alsoOnNotice(feature: CardFeature, alsoOn: readonly CardFeature[]): string {
  const names = alsoOn.map((each) => each.name);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return names.length === 1
    ? `${feature.name} is on. ${list} is on too, because ${feature.name} needs it.`
    : `${feature.name} is on. ${list} are on too, because ${feature.name} needs them.`;
}

const readmes = import.meta.glob<string>("../../../features/*/README.md", { query: "?raw", import: "default", eager: true });
const changelogs = import.meta.glob<string>("../../../features/*/CHANGELOG.md", { query: "?raw", import: "default", eager: true });
const fileOf = (files: Readonly<Record<string, string>>, feature: CardFeature, name: string) => files[`../../../features/${folderForId(feature.id)}/${name}`] ?? "";

/**
 * The README in the subset app/features/contract.ts allows. Links reach only www.gwonmac.com,
 * images never show, and Vue renders every block as text.
 */
export const readmeBlocks = (feature: CardFeature): readonly MarkdownBlock[] =>
  parseMarkdown(fileOf(readmes, feature, "README.md"), { link: (href) => guideLink(href), image: () => null });

export type ChangelogVersion = Readonly<{ version: string; items: readonly (readonly MarkdownInline[])[] }>;

/** The released versions in a CHANGELOG, newest first; `## Unreleased` waits for the release script (plan step 7.2). */
export function parseChangelog(text: string): readonly ChangelogVersion[] {
  const versions: { version: string; items: (readonly MarkdownInline[])[] }[] = [];
  for (const line of text.split("\n").map((each) => each.trim())) {
    const heading = /^## (.+)$/u.exec(line);
    if (heading) versions.push({ version: heading[1]!, items: [] });
    else if (line.startsWith("- ") && versions.length > 0) versions.at(-1)!.items.push(markdownInline(line.slice(2), { link: (href) => guideLink(href), image: () => null }));
  }
  return versions.filter(({ version, items }) => version !== "Unreleased" && items.length > 0);
}
export const changelogOf = (feature: CardFeature) => parseChangelog(fileOf(changelogs, feature, "CHANGELOG.md"));

/** "New" when this app version brought the feature, "Updated" when it changed it, else nothing. */
export function badgeOf(versions: readonly ChangelogVersion[], appVersion: string): "New" | "Updated" | null {
  if (versions[0]?.version !== appVersion) return null;
  return versions.length === 1 ? "New" : "Updated";
}

/** One option on the Feature page, drawn from the manifest's typed settings. */
export type FeatureOption = Readonly<{ key: LauncherSetting; label: string; help: string }> & (
  | Readonly<{ kind: "switch" }>
  | Readonly<{ kind: "range"; min: number; max: number }>
  | Readonly<{ kind: "position"; fallback: unknown }>
  /** A setting with its own control (a style, colours, keys): its Settings row changes it. */
  | Readonly<{ kind: "elsewhere"; target: SettingsTarget }>
);

const launcherKeys: ReadonlySet<string> = new Set(LAUNCHER_SETTINGS);
const isLauncherSetting = (key: string): key is LauncherSetting => launcherKeys.has(key);

export function featureOptions(feature: CardFeature): readonly FeatureOption[] {
  const options: FeatureOption[] = [];
  for (const [key, spec] of Object.entries("settings" in feature ? feature.settings : {})) {
    if (key === FEATURE_SELECTION_POLICIES[feature.id].switch || !isLauncherSetting(key)) continue;
    const text = { key, label: spec.label, help: spec.help };
    if (spec.kind === "boolean") options.push({ ...text, kind: "switch" });
    else if (spec.kind === "integer" && "range" in spec && spec.range) options.push({ ...text, kind: "range", min: spec.range.min, max: spec.range.max });
    else if (spec.kind === "position") options.push({ ...text, kind: "position", fallback: spec.fallback });
    else {
      const entry = SETTINGS.find((candidate) => candidate.id === key);
      options.push({ ...text, kind: "elsewhere", target: entry ? { section: entry.section, control: entry.id } : { section: "tools" } });
    }
  }
  return options;
}
