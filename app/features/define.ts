/**
 * The static manifest of one feature (manifest v2): its name and words for players,
 * what it uses and needs, its settings, shortcuts and Hub entry, and the parts that
 * run. A manifest is data only, with no side effects, so main, preload, renderer
 * and the Vue apps can all read it.
 *
 * Adding a feature: `pnpm new-feature <id>` writes the folder app/features/<folder>/ with
 * feature.ts (`defineFeature`), README.md, CHANGELOG.md and media/, and adds it to FEATURES in
 * ./index.ts (docs/feature-contract.md). Every list in app/shared derives from FEATURES. ./contract.ts checks what TypeScript cannot, and
 * tests/policy/feature-contract.test.ts runs it in `pnpm check`.
 * A manifest may import app/shared/settings/define.ts, value validators, and types;
 * never app/shared/settings/index.ts, contracts.ts or keyboard-shortcuts.ts at
 * runtime, which import FEATURES themselves.
 */
import type { FeatureUse } from "../shared/contracts.js";
import type { EnhancementProgram } from "../shared/enhancement-contracts.js";
import type { ManifestStage } from "../shared/release.js";
import type { ShortcutBinding } from "../shared/keyboard-shortcuts.js";
import { setting, type SettingScope, type SettingSpec } from "../shared/settings/define.js";
import type { HubIconKind } from "../shared/ui/hub-icon.js";

/**
 * A Features row Core draws for a tool without loading its code: its detail, its icon, its action
 * name (`Open <name>` by default) and how it opens; it matches the tool's `keywords`. A row
 * opens its tool through its Feature's link `toggle` (`offers`), asked to `show` (never to
 * close): in place (`{}`), as a Hub page (`page`, so Right Arrow opens it too) or after the Hub
 * closes (`closesHub`); or it opens its own Feature page in the Hub's Settings (`featurePage`).
 */
export type HubToolRow = Readonly<{
  detail: string;
  iconKind: HubIconKind;
  action?: string;
  aliases?: readonly string[];
  open: Readonly<{ page?: true; closesHub?: true }> | Readonly<{ featurePage: true }>;
}>;

/**
 * The Features tab's groups: what the player is doing when they use a Feature. `mode` is the
 * launch mode itself (the `tools` feature): the plain-game strip, not a card.
 */
export const FEATURE_KINDS = ["around", "fight", "party", "chat", "inventory", "mode"] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];
/** The group heading players see for each card kind, in the order the Features tab lists them. */
export const FEATURE_KIND_LABELS: Readonly<Record<Exclude<FeatureKind, "mode">, string>> = {
  around: "Getting around",
  fight: "Fighting",
  party: "Party & builds",
  chat: "Chat & trade",
  inventory: "Inventory",
};

/**
 * How a player meets a Feature once it is on, shown as a tag on its card: `screen` draws
 * something in the game, `tool` is a panel or page they open, `action` does one thing in the game
 * when they ask, and `background` works on its own. Every card names one; the launch mode does not.
 */
export const FEATURE_PRESENCES = ["screen", "tool", "action", "background"] as const;
export type FeaturePresence = (typeof FEATURE_PRESENCES)[number];

/**
 * What runs: `game` in the game host, `hubPage` a page of its own in the Hub, `window`
 * in the Tools window, `main` in the main process (its main.ts, and the only part that
 * may reach the `network` hosts). Every kind has one shape, `start → stop` (./parts.ts).
 */
export const FEATURE_PART_KINDS = ["game", "hubPage", "window", "main"] as const;
export type FeaturePartKind = (typeof FEATURE_PART_KINDS)[number];

/** The words a player sees for one feature setting: its row label and one line of help. */
export type FeatureSettingText = Readonly<{ label: string; help: string }>;
/** Marks a Feature's switch; only `featureSwitch` sets it. */
export type FeatureSwitchMark = Readonly<{ switch: true }>;
type FeatureSwitchSpec = SettingSpec<boolean> & FeatureSwitchMark & Partial<FeatureSettingText>;
export type FeatureSettingSpecs = Readonly<Record<string, (SettingSpec<unknown> & FeatureSettingText) | FeatureSwitchSpec>>;

/**
 * A Feature's switch: the stored boolean that turns it on, declared in its `settings` under the
 * key released apps already store (the key rule in docs/settings.md). A Feature has at most one;
 * one without a switch follows the Features it `requires`. Players see a card's switch under the
 * Feature's `name` and `summary`, so it names nothing itself (./contract.ts). The launch mode's
 * switch names itself: players see it inverted, as "Play the plain game".
 */
/** The key of a feature's switch, or never for a feature without one. */
export type FeatureSwitchKey<Each> = Each extends Readonly<{ settings: infer Specs }>
  ? { [Key in keyof Specs]: Specs[Key] extends FeatureSwitchMark ? Key : never }[keyof Specs] & string
  : never;
export const featureSwitch = <const Options extends SettingScope & Partial<FeatureSettingText>>(fallback: boolean, options: Options) =>
  setting.boolean(fallback, { ...options, switch: true as const });

export type FeatureDefinition = Readonly<{
  /**
   * The folder name in camelCase: folder `alcohol-timer` holds `alcoholTimer` (./contract.ts).
   * The id keys the runtime policy, which tests name by id (tests/unit/feature-selection.test.ts
   * and the AGENTS.md "Must stay" tests/certification/feature-region-gating.test.ts), so it stays camelCase.
   */
  id: string;
  /** The player name: card title, Feature page title, Hub row. */
  name: string;
  /** One plain sentence under the name: card line, Feature page. */
  summary: string;
  kind: FeatureKind;
  /** How a player meets it once it is on; every feature but the launch mode names one (./contract.ts). */
  presence?: FeaturePresence;
  /** A Lucide icon name in kebab case, from lucide-vue-next, the set the launcher uses. */
  icon: string;
  /** Settings this feature owns: its switch (`featureSwitch`), and options, each with a label and help. */
  settings?: FeatureSettingSpecs;
  /** One line under the Settings heading on its Feature page, for a rule that spans its options. */
  settingsHelp?: string;
  /**
   * A Feature still in development: it runs and shows only in builds at this stage or later
   * (app/shared/release.ts). Elsewhere resolve has it off as `not-in-release`, so the catalog, its
   * Hub rows and shortcuts leave it out, and its website page is not built. Delete the line to
   * ship it (docs/feature-contract.md#release-stages).
   */
  stage?: ManifestStage;
  /** The coarse region rule; a feature's live-state gate stays authoritative. */
  region: "any" | "non-pvp" | "pve";
  /**
   * Its window part may open in every game area its switch allows, not only where `region` lets
   * it run: the Build Library's saved authoring works anywhere, while live observation and Apply
   * keep their own gates. A safety exception: tests/certification/window-area.test.ts pins which
   * Features declare it.
   */
  windowArea?: "any";
  /** Features that must be on for this one to run, by id (app/shared/feature-resolve.ts). */
  requires?: readonly string[];
  /**
   * What it uses: verifier capabilities and certified stages (STAGE_USES) without which this
   * feature does nothing. A feature that still does part of its job without a capability (saved
   * builds without live party data) leaves it out. A feature whose code imports a stage's
   * contract names that stage (app/features/contract.ts).
   */
  uses?: readonly FeatureUse[];
  /** Developer programs that select this feature regardless of its saved setting. */
  programs?: readonly EnhancementProgram[];
  /** The internet hosts its `main` part reaches. Absent: it reaches none. */
  network?: readonly string[];
  /** Enabling Tools in first-run setup also turns this feature's switch on. */
  optInWithTools?: true;
  /** The feature's switch on its card and Feature page, shown with `name` and `summary`; GLOBAL_TOOLS keeps FEATURES order. */
  tool?: Readonly<{
    /**
     * The stable id of its switch control, `tool:<id>`: players' Hub pins and phrases
     * (`setting:tool:<id>`) and README links (`features/tool:<id>`) store it, so it never
     * changes, even where it differs from the folder (Travel's `quick-travel`).
     */
    id: string;
    /** Extra words Settings search and the tool's Hub row match. */
    keywords?: string;
    /**
     * The renderer event that runs this tool, for a tool the input host runs (Call Target). Its
     * shortcut's command fires it (app/renderer/commands.ts). A feature that offers `toggle` opens
     * its tool through that link instead and names no event. A listener cancels the event to
     * claim it and, given an object detail, sets `error` on it to refuse.
     */
    event?: `gw:${string}`;
  }>;
  /**
   * The Hub's Features row that runs this feature's tool and shows its shortcut, by its id
   * `command`; it needs `tool`. `order` places it among the Features rows, lowest first;
   * `keyOrder`, when present, also lists the shortcut on the Hub's Commands page, lowest
   * first. With `row`, Core draws the row from this manifest (app/shared/hub-tools.ts); a
   * tool whose own Hub source attaches the row (Travel, Build Library) leaves it out.
   */
  hub?: Readonly<{ command: string; order: number; keyOrder?: number; row?: HubToolRow }>;
  /**
   * App shortcuts this feature runs. One without a `label` is the tool's own shortcut and
   * takes the feature's name; `menuItem` is the game menu item that runs the same action.
   */
  shortcuts?: readonly Readonly<{
    action: string;
    binding: ShortcutBinding | null;
    label?: string;
    menuItem?: string;
  }>[];
  /**
   * The methods of this feature's link that other features may call, by name. Their types live
   * in its shared/link.ts and are registered once in FeatureLinkApis (./links.ts).
   */
  offers?: readonly string[];
  /**
   * Other features' links this feature calls, by target id, each with the methods it calls:
   * `{ whispers: ["open"] }`. Its parts get `links.whispers`, which is null while resolve has
   * Whispers off (./links.ts, app/renderer/feature-links.ts).
   */
  links?: Readonly<Record<string, readonly string[]>>;
  /** Captions for media/shot-1.webp, shot-2.webp, … in order: the Feature page gallery. */
  shots: readonly string[];
  /** The parts that run. */
  parts: readonly FeaturePartKind[];
}>;

/** The switches among a Feature's own settings: what an option's `dependsOn` may name. */
type OwnSwitchKey<Specs> = { [Key in keyof Specs]: Specs[Key] extends SettingSpec<boolean> ? Key : never }[keyof Specs] & string;
/** Requires each `dependsOn` to name a switch of the same Feature, so a typo fails to compile. */
type DependsOnOwnSwitch<Feature> = Feature extends Readonly<{ settings: infer Specs }>
  ? Readonly<{ settings: { [Key in keyof Specs]: Specs[Key] extends Readonly<{ dependsOn: string }> ? Readonly<{ dependsOn: OwnSwitchKey<Specs> }> : unknown } }>
  : unknown;

export const defineFeature = <const Feature extends FeatureDefinition>(feature: Feature & DependsOnOwnSwitch<Feature>): Feature => feature;
