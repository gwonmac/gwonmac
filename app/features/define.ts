/**
 * The static manifest of one feature (manifest v2): its name and words for players,
 * what it uses and needs, its settings, shortcuts and Hub entry, and the parts that
 * run. A manifest is data only, with no side effects, so main, preload, renderer
 * and the Vue apps can all read it.
 *
 * Adding a feature: make the folder app/features/<folder>/ with feature.ts (`defineFeature`),
 * README.md, CHANGELOG.md and media/, and add it to FEATURES in ./index.ts. Every list in
 * app/shared derives from FEATURES. ./contract.ts checks what TypeScript cannot, and
 * tests/policy/feature-contract.test.ts runs it in `pnpm check`.
 * A manifest may import app/shared/settings/define.ts, value validators, and types;
 * never app/shared/settings/index.ts, contracts.ts or keyboard-shortcuts.ts at
 * runtime, which import FEATURES themselves.
 */
import type { EnhancementCapability, EnhancementProgram } from "../shared/enhancement-contracts.js";
import type { ShortcutBinding } from "../shared/keyboard-shortcuts.js";
import type { SettingSpec } from "../shared/settings/define.js";
import type { SettingsSection } from "../shared/settings-catalogue.js";
import type { HubIconKind } from "../shared/ui/hub-icon.js";

/**
 * A Tools row Core draws for a tool without loading its code: its detail, its icon, its action
 * name (`Open <name>` by default) and how it opens; it matches the tool's `keywords`. A tool
 * opens through its own `event`, asked to `show` (never to close), as a Hub page (`page`, so
 * Right Arrow opens it too) or after the Hub closes (`closesHub`); or at a Settings section.
 */
export type HubToolRow = Readonly<{
  detail: string;
  iconKind: HubIconKind;
  action?: string;
  aliases?: readonly string[];
  open: Readonly<{ show?: true; page?: true; closesHub?: true }> | Readonly<{ settings: SettingsSection }>;
}>;

/** What selects a feature, before its region and any live-state gate. */
export type FeatureActivation =
  /** The master switch itself: on loads Features at launch, off is the plain game. */
  | Readonly<{ kind: "master"; setting: string }>
  /** Selected by its own setting while the master switch is on (not in the plain game). */
  | Readonly<{ kind: "setting"; setting: string; master: string }>;

/**
 * How the Features tab groups a feature (Group by: Kind). `mode` is the launch mode
 * itself (the `tools` feature): the plain-game strip, not a card.
 */
export const FEATURE_KINDS = ["maps", "combat", "party", "chat", "items", "helpers", "mode"] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

/**
 * What runs: `game` in the game host, `hubPage` a page of its own in the Hub, `window`
 * in the Tools window, `main` in the main process (its main.ts, and the only part that
 * may reach the `network` hosts).
 */
export const FEATURE_PART_KINDS = ["game", "hubPage", "window", "main"] as const;
export type FeaturePartKind = (typeof FEATURE_PART_KINDS)[number];

/** The words a player sees for one feature setting: its row label and one line of help. */
export type FeatureSettingText = Readonly<{ label: string; help: string }>;
export type FeatureSettingSpecs = Readonly<Record<string, SettingSpec<unknown> & FeatureSettingText>>;

export type FeatureDefinition = Readonly<{
  /** The folder name in camelCase: folder `alcohol-timer` holds `alcoholTimer` (./contract.ts). */
  id: string;
  /** The player name: card title, Feature page title, Settings › Tools, Hub row. */
  name: string;
  /** One plain sentence under the name: card line, Settings › Tools. */
  summary: string;
  kind: FeatureKind;
  /** A Lucide icon name in kebab case, from lucide-vue-next, the set the launcher uses. */
  icon: string;
  /** Settings this feature owns, each with a label and help. Another feature may name one in its activation. */
  settings?: FeatureSettingSpecs;
  /** The setting that selects the feature. It stays until plan step 4.4 settles the settings keys. */
  activation: FeatureActivation;
  /** The coarse region rule; a feature's live-state gate stays authoritative. */
  region: "any" | "non-pvp" | "pve";
  /** Features that must be on for this one to run, by id (app/shared/feature-resolve.ts). */
  requires?: readonly string[];
  /**
   * What it uses: verifier capabilities without which this feature does nothing. A feature
   * that still does part of its job without a capability (saved builds without live party
   * data) leaves it out. The contract names this `uses`; the rename is a follow-up
   * (docs/feature-platform-plan.md, step 4.3).
   */
  capabilities?: readonly EnhancementCapability[];
  /** Developer programs that select this feature regardless of its saved setting. */
  programs?: readonly EnhancementProgram[];
  /** The internet hosts its `main` part reaches. Absent: it reaches none. */
  network?: readonly string[];
  /** Enabling Tools in first-run setup also turns this feature's setting on. */
  optInWithTools?: true;
  /** The feature's switch in Settings › Tools, shown with `name` and `summary`; GLOBAL_TOOLS keeps FEATURES order. */
  tool?: Readonly<{
    id: string;
    /** Extra words Settings search and the tool's Hub row match. */
    keywords?: string;
    /**
     * The renderer event that runs this tool. Its shortcut's command fires it
     * (app/renderer/commands.ts), and so does its Hub row. A listener cancels the event to
     * claim it and, given an object detail, sets `error` on it to refuse.
     */
    event?: `gw:${string}`;
  }>;
  /**
   * The Hub's Tools row that runs this feature's tool and shows its shortcut, by its id
   * `command`; it needs `tool`. `order` places it among the Tools rows, lowest first;
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
  /** Captions for media/shot-1.webp, shot-2.webp, … in order: the Feature page gallery. */
  shots: readonly string[];
  /** The parts that run. */
  parts: readonly FeaturePartKind[];
}>;

export const defineFeature = <const Feature extends FeatureDefinition>(feature: Feature): Feature => feature;
