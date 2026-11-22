/**
 * The Features tab's model. Every card comes from a feature's manifest (app/features) and its
 * README.md and CHANGELOG.md; every status comes from resolve (app/shared/feature-resolve.ts).
 * This module adds only what the tab itself decides: the words for each reason, which saved
 * switch a card moves, how cards group, and the switch changes that turn a feature on together
 * with what it needs.
 */
import { BUILD_CHECK_FAILED } from "@shared/contracts";
import {
  FEATURES,
  FEATURE_KIND_LABELS,
  FEATURE_SELECTION_POLICIES,
  FEATURE_PURPOSE_LABELS,
  folderForId,
  type FeatureId,
} from "@shared/feature-contracts";
import { resolve, type FeatureOffReason, type FeatureResolution, type FeatureState } from "@shared/feature-resolve";
import { GLOBAL_TOOLS, GLOBAL_TOOL_FEATURES, type GlobalTool, type LauncherSnapshot } from "@shared/launcher-contracts";
import { markdownInline, parseMarkdown, type MarkdownBlock, type MarkdownInline } from "@shared/launcher-markdown";
import { SETTINGS, type SettingsTarget } from "@shared/settings-catalogue";
import { LAUNCHER_SETTINGS, type LauncherSetting } from "@shared/settings/index";
import type { Feature } from "../../../features/index";
import { guideLink } from "./guide";

/** A feature with a card: every feature but the launch mode, which is the plain-game strip. */
export type CardFeature = Exclude<Feature, Readonly<{ kind: "mode" }>>;
export const CARD_FEATURES: readonly CardFeature[] = FEATURES.filter((feature): feature is CardFeature => feature.kind !== "mode");
const byId = new Map<FeatureId, CardFeature>(CARD_FEATURES.map((feature) => [feature.id, feature]));
export const cardFeature = (id: FeatureId): CardFeature | undefined => byId.get(id);

/**
 * The saved switch each card moves: its own tool's, or for a feature with no switch of its own
 * (Progress, Team Apply), the switch of the feature it runs with.
 */
const toolByFeature = new Map<FeatureId, GlobalTool>(GLOBAL_TOOLS.map((tool) => [GLOBAL_TOOL_FEATURES[tool], tool]));
export function switchOf(feature: CardFeature): GlobalTool {
  const tool = [feature, ...requiredFeatures(feature)].map((each) => toolByFeature.get(each.id)).find((each) => each !== undefined);
  if (tool === undefined) throw new Error(`${feature.id} has no switch`);
  return tool;
}

/**
 * resolve's state as the launcher sees it: main's facts (app/main/feature-decision.ts), which
 * carry the verifier's statuses for the client build the app serves. The launcher is not a game
 * window: no character stands anywhere (`unknown`, which featureStatus reads as on).
 */
export function launcherFeatureState(facts: LauncherSnapshot["features"]): FeatureState {
  return { ...facts, playRegion: "unknown" };
}

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
  needs?: CardFeature;
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

export const REGION_WORDS: Readonly<Record<CardFeature["region"], string>> = { pve: "PvE", "non-pvp": "Outside PvP", any: "Everywhere" };

export function featureStatus(feature: CardFeature, state: FeatureState, tools: LauncherSnapshot["tools"]): FeatureStatus {
  const resolution = resolve(feature, state);
  const checked = tools.features[switchOf(feature)].enabled;
  // resolve tests the area last, so `wrong-area` means only the area is missing. The launcher
  // stands in no area: the feature is on and starts where its region chip says.
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

/** Every feature this one needs, nearest first, each once. */
function requiredFeatures(feature: CardFeature): CardFeature[] {
  const found: CardFeature[] = [];
  const visit = (each: CardFeature) => {
    for (const id of "requires" in each ? each.requires : []) {
      const required = byId.get(id);
      if (required && !found.includes(required)) { found.push(required); visit(required); }
    }
  };
  visit(feature);
  return found;
}

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
