/**
 * The static manifest of one feature: its settings, when it is selected, and how
 * the launcher, menus, shortcuts and Hub name it. A manifest is data only, with
 * no side effects, so main, preload, renderer and the Vue apps can all read it.
 *
 * Adding a feature: write app/features/<id>/feature.ts with `defineFeature` and
 * add it to FEATURES in ./index.ts. Every list in app/shared derives from FEATURES.
 * A manifest may import app/shared/settings/define.ts, value validators, and types;
 * never app/shared/settings/index.ts, contracts.ts or keyboard-shortcuts.ts at
 * runtime, which import FEATURES themselves.
 */
import type { EnhancementProgram } from "../shared/enhancement-contracts.js";
import type { ShortcutBinding } from "../shared/keyboard-shortcuts.js";
import type { SettingSpecs } from "../shared/settings/define.js";
import type { SettingsSection } from "../shared/settings-catalogue.js";
import type { HubIconKind } from "../shared/ui/hub-icon.js";

/**
 * A Tools row Core draws for a tool without loading its code: its detail, its icon, its action
 * name (`Open <label>` by default) and how it opens; it matches the tool's `keywords`. A tool
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
  /** The master switch itself: optional Tools. */
  | Readonly<{ kind: "master"; setting: string }>
  /** Selected by its own setting, with or without the master switch. */
  | Readonly<{ kind: "independent"; setting: string }>
  /** Selected by its own setting while the master switch is on. */
  | Readonly<{ kind: "setting"; setting: string; master: string }>;

export type FeatureDefinition = Readonly<{
  id: string;
  /** Settings this feature owns. Another feature may name one in its activation. */
  settings?: SettingSpecs;
  activation: FeatureActivation;
  /** The coarse region rule; a feature's live-state gate stays authoritative. */
  region: "any" | "non-pvp" | "pve";
  /** Developer programs that select this feature regardless of its saved setting. */
  programs?: readonly EnhancementProgram[];
  /** Enabling Tools in first-run setup also turns this feature's setting on. */
  optInWithTools?: true;
  /** The feature's switch in Settings › Tools; GLOBAL_TOOLS keeps FEATURES order. */
  tool?: Readonly<{
    id: string;
    label: string;
    description: string;
    /** Extra words Settings search and the tool's Hub row match. */
    keywords?: string;
    /**
     * The renderer event that runs this tool. Its shortcut's command fires it
     * (app/renderer/commands.ts), and so does its Hub row. A listener cancels the event to
     * claim it and, given an object detail, sets `error` on it to refuse.
     */
    event?: `gw:${string}`;
    /**
     * The Hub's Tools row that runs this tool and shows its shortcut, by its id `command`.
     * `order` places it among the Tools rows, lowest first; `keyOrder`, when present, also
     * lists the shortcut on the Hub's Commands page, lowest first. With `row`, Core draws the
     * row from this manifest (app/shared/hub-tools.ts); a tool whose own Hub source attaches
     * the row (Travel, Build Library) leaves it out.
     */
    hub?: Readonly<{ command: string; order: number; keyOrder?: number; row?: HubToolRow }>;
  }>;
  /**
   * App shortcuts this feature runs. One without a `label` is the tool's own shortcut and
   * takes the tool's name; `menuItem` is the game menu item that runs the same action.
   */
  shortcuts?: readonly Readonly<{
    action: string;
    binding: ShortcutBinding | null;
    label?: string;
    menuItem?: string;
  }>[];
}>;

export const defineFeature = <const Feature extends FeatureDefinition>(feature: Feature): Feature => feature;
