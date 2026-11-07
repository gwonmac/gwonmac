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
import type { EnhancementCapability, EnhancementProgram } from "../shared/enhancement-contracts.js";
import type { ShortcutBinding } from "../shared/keyboard-shortcuts.js";
import type { SettingSpecs } from "../shared/settings/define.js";

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
    /** Extra words Settings search matches. */
    keywords?: string;
    /**
     * The Hub command row that runs this tool and shows its shortcut. `keyOrder`, when
     * present, also lists the shortcut on the Hub's Commands page, lowest first.
     */
    hub?: Readonly<{ command: string; keyOrder?: number }>;
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
  /** Capability ids this feature needs; references only, the registry stays in enhancement-contracts. */
  capabilities?: readonly EnhancementCapability[];
}>;

export const defineFeature = <const Feature extends FeatureDefinition>(feature: Feature): Feature => feature;
