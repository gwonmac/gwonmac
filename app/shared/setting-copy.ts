/**
 * Owns the words for settings that both the launcher and Hub Settings show: one
 * label, one description and one "when it applies" note per stored value, so the
 * two surfaces can never name the same setting differently (docs/settings.md).
 * A feature option's label and help come from its manifest (app/features/<folder>/feature.ts).
 */
import { CARTOGRAPHY_REVEAL_MODES, type CartographyRevealMode } from "./cartography-overlay.js";
import { featureSettingText, type FeatureSettingKey } from "./feature-contracts.js";
import { CONTROLLER_PROMPT_STYLES, RENDER_SCALES, type ControllerPromptStyle, type RenderScale } from "./settings/core.js";

/**
 * The value a select shows, found among the setting's allowed values. A select's
 * value is a string, so this is how it becomes a setting value without a cast; it
 * is undefined when no allowed value matches, and then nothing is saved.
 */
export function optionFor<T extends string | number>(values: readonly T[], raw: string): T | undefined {
  return values.find((value) => String(value) === raw);
}

/** When a saved change takes effect. `now` needs no note. */
export type SettingApplies = "now" | "next-game" | "next-login";

export const SETTING_APPLIES_NOTE: Readonly<Record<SettingApplies, string>> = {
  now: "",
  "next-game": "Applies when you next open or reload a game window.",
  "next-login": "Applies at the next login screen.",
};

type Copy = Readonly<{ label: string; detail: string; applies: SettingApplies; keywords?: string }>;

/** Settings › Game, in display order. */
export const GAME_SETTINGS = {
  renderScale: { label: "Render quality", detail: "Higher quality uses more graphics power.", applies: "now", keywords: "graphics resolution scale sharp" },
  autoRelogAfterReload: { label: "Return to character after reload", detail: "Sign in and return to the last character after reloading the game.", applies: "now", keywords: "relog login reload automatic" },
  controllerPromptStyle: { label: "Controller symbols", detail: "Button symbols shown for a game controller.", applies: "next-game", keywords: "gamepad playstation xbox buttons" },
  disableSteamLogin: { label: "Disable Steam login", detail: "Do not offer Steam as a way to sign in. The login screen then shows only the ArenaNet email and password form.", applies: "next-login", keywords: "steam login sign in account provider password email" },
  pasteCleanup: { label: "Clean pasted text", detail: "Remove invisible characters and outer spaces from text you paste into a game text field, so a copied name works like a typed one. Password and email fields are never changed.", applies: "now", keywords: "paste clipboard name discord invisible spaces trim" },
  hubCalculators: { label: "Hub calculators", detail: "Currency conversions, conversion rates and the title calculator in Hub search.", applies: "now", keywords: "calculator disable hide conversions currency" },
  showDiagnostics: { label: "Diagnostics overlay", detail: "Show frame and memory diagnostics in open game windows.", applies: "now", keywords: "fps debug performance" },
} as const satisfies Readonly<Record<string, Copy>>;

const RENDER_SCALE_LABELS: Readonly<Record<RenderScale, string>> = {
  1: "Standard · 1×",
  1.5: "High · 1.5×",
  2: "Very high · 2×",
};

const CONTROLLER_SYMBOL_LABELS: Readonly<Record<ControllerPromptStyle, string>> = {
  "game-default": "Game default",
  playstation: "PlayStation",
};

/** Option lists follow the setting's own value list, so every stored value has exactly one option. */
export const RENDER_SCALE_OPTIONS = RENDER_SCALES.map((value) => ({ value, label: RENDER_SCALE_LABELS[value] }));
export const CONTROLLER_SYMBOL_OPTIONS = CONTROLLER_PROMPT_STYLES.map((value) => ({ value, label: CONTROLLER_SYMBOL_LABELS[value] }));

/** Reveal range: `label` in Settings › Maps, `compact` in the narrow Compass panel. */
const REVEAL_MODE_LABELS: Readonly<Record<CartographyRevealMode, Readonly<{ label: string; compact: string }>>> = {
  off: { label: "Off", compact: "Off" },
  normal: { label: "Normal · 3×3", compact: "3×3" },
  "birds-eye": { label: "Bird’s Eye · 7×7", compact: "7×7" },
};
export const REVEAL_MODE_OPTIONS = CARTOGRAPHY_REVEAL_MODES.map((value) => ({ value, ...REVEAL_MODE_LABELS[value] }));

/** A feature option, named by its manifest (app/features/<folder>/feature.ts). */
const named = <const Key extends FeatureSettingKey>(key: Key) => ({ key, label: featureSettingText(key).label });
/** A feature option with its manifest help as the line under it. */
const explained = <const Key extends FeatureSettingKey>(key: Key) => ({ ...named(key), detail: featureSettingText(key).help });

/** Character Switch options, shown under that tool. */
export const CHARACTER_DETAILS = [
  named("characterSwitchProfession"),
  named("characterSwitchLevel"),
  named("characterSwitchLocation"),
] as const;

/** Chat Filters options, shown under that tool. On hides those messages. */
export const CHAT_FILTERS = [
  named("chatFilterAllyDrops"),
  named("chatFilterHallOfHeroes"),
  named("chatFilterTitleAchievements"),
] as const;

/** Reminders options, shown under that tool: what to remind about, when, and how. */
export const REMINDER_GROUPS = [
  explained("reminderCons"),
  explained("reminderPcons"),
  explained("reminderAlcohol"),
] as const;
export const REMINDER_TIMING = [
  named("reminderBeforeEnd"),
  named("reminderAtEnd"),
] as const;
export const REMINDER_SOUND = explained("reminderSound");

/** The full note for a setting: its description, then when it applies. */
export function settingDetail(copy: Copy): string {
  return [copy.detail, SETTING_APPLIES_NOTE[copy.applies]].filter(Boolean).join(" ");
}
