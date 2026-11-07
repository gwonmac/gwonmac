/**
 * Owns the words for settings that both the launcher and Hub Settings show: one
 * label, one description and one "when it applies" note per stored value, so the
 * two surfaces can never name the same setting differently (docs/settings.md).
 */
import { CARTOGRAPHY_REVEAL_MODES, type CartographyRevealMode } from "./cartography-overlay.js";
import { CONTROLLER_PROMPT_STYLES, RENDER_SCALES, type ControllerPromptStyle, type RenderScale } from "./settings/core.js";

/** When a saved change takes effect. `now` needs no note. */
export type SettingApplies = "now" | "next-game" | "restart";

export const SETTING_APPLIES_NOTE: Readonly<Record<SettingApplies, string>> = {
  now: "",
  "next-game": "Applies when you next open or reload a game window.",
  restart: "Applies after you restart GWonMac.",
};

type Copy = Readonly<{ label: string; detail: string; applies: SettingApplies; keywords?: string }>;

/** Settings › Game, in display order. */
export const GAME_SETTINGS = {
  renderScale: { label: "Render quality", detail: "Higher quality uses more graphics power.", applies: "now", keywords: "graphics resolution scale sharp" },
  extendedMemoryEnabled: { label: "Extended memory", detail: "Allow longer sessions to use up to 4 GB instead of 2 GB. Experimental.", applies: "restart", keywords: "memory ram 4gb out of memory crash" },
  autoRelogAfterReload: { label: "Return to character after reload", detail: "Sign in and return to the last character after reloading the game.", applies: "now", keywords: "relog login reload automatic" },
  controllerPromptStyle: { label: "Controller symbols", detail: "Button symbols shown for a game controller.", applies: "next-game", keywords: "gamepad playstation xbox buttons" },
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

/** Character Switch options, shown under that tool. */
export const CHARACTER_DETAILS = [
  { key: "characterSwitchProfession", label: "Show profession" },
  { key: "characterSwitchLevel", label: "Show level" },
  { key: "characterSwitchLocation", label: "Show location" },
] as const;

/** Chat Filters options, shown under that tool. On hides those messages. */
export const CHAT_FILTERS = [
  { key: "chatFilterAllyDrops", label: "Hide other party members' item drops" },
  { key: "chatFilterHallOfHeroes", label: "Hide Hall of Heroes winner announcements" },
  { key: "chatFilterTitleAchievements", label: "Hide player title achievements" },
] as const;

/** Reminders options, shown under that tool: what to remind about, when, and how. */
export const REMINDER_GROUPS = [
  { key: "reminderCons", label: "Cons", detail: "Essence of Celerity, Grail of Might, Armor of Salvation" },
  { key: "reminderPcons", label: "Pcons", detail: "Cupcakes, candies, Rock Candy, War Supplies, Lunar Blessing and more" },
  { key: "reminderAlcohol", label: "Alcohol", detail: "An estimate, so its lines say \"about\"" },
] as const;
export const REMINDER_TIMING = [
  { key: "reminderBeforeEnd", label: "1 minute before it runs out" },
  { key: "reminderAtEnd", label: "When it has run out" },
] as const;
export const REMINDER_SOUND = { key: "reminderSound", label: "Play a sound", detail: "One short chime, even when several reminders arrive together" } as const;

/** The full note for a setting: its description, then when it applies. */
export function settingDetail(copy: Copy): string {
  return [copy.detail, SETTING_APPLIES_NOTE[copy.applies]].filter(Boolean).join(" ");
}
