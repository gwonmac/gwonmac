/**
 * Owns where every setting lives and how a player finds it: its section, a stable control
 * ID, its label and the words players search with. Settings search and deep links (Hub search,
 * the memory warning) use these IDs; each rendered control carries `data-setting="<id>"`.
 * Labels, descriptions and tool keywords come from their owners (feature manifests, setting-copy, tool-presentation), so a
 * setting has one name everywhere (docs/settings.md): a feature's row takes its manifest's label and help, word for word.
 */
import { CHARACTER_DETAILS, CHAT_FILTERS, GAME_SETTINGS, REMINDER_GROUPS, REMINDER_SOUND, REMINDER_TIMING, type SettingApplies } from "./setting-copy.js";
import { featureSettingText, type FeatureSettingKey } from "./feature-contracts.js";
import { GLOBAL_TOOLS, type GlobalTool } from "./launcher-contracts.js";
import { TOOL_KEYWORDS, TOOL_PRESENTATION } from "./tool-presentation.js";

/** Settings sections in sidebar order: game settings first, by how often players change them. */
export const SETTINGS_SECTIONS = [
  { id: "tools", label: "Tools", group: "game", keywords: "features optional" },
  { id: "maps", label: "Maps", group: "game", keywords: "grid terrain compass elite cartographer" },
  { id: "appearance", label: "Appearance", group: "game", keywords: "theme look style colors font opacity panels" },
  { id: "game", label: "Game", group: "game", keywords: "graphics memory diagnostics controller quality" },
  { id: "texture-packs", label: "Texture packs", group: "game", keywords: "textures mods graphics" },
  { id: "game-files", label: "Game files", group: "game", keywords: "download repair disk space" },
  { id: "updates", label: "Updates", group: "app", keywords: "update version beta stable" },
  { id: "home", label: "Home screen", group: "app", keywords: "news dailies events launcher" },
  { id: "advanced", label: "Advanced", group: "app", keywords: "logs reset support copy paste transfer" },
] as const;
export type SettingsSection = typeof SETTINGS_SECTIONS[number]["id"];
export const SETTINGS_GROUP_LABELS = { game: "In game", app: "GWonMac" } as const;
/**
 * The sections the Hub draws in a game window (docs/settings.md). They change only what
 * app/shared/hub-settings.ts lets a game window change; the others open the launcher.
 */
export const HUB_SECTIONS: ReadonlySet<SettingsSection> = new Set(["tools", "maps", "appearance", "game"]);

export function parseSettingsSection(value: unknown): SettingsSection {
  const section = SETTINGS_SECTIONS.find(candidate => candidate.id === value);
  if (!section) throw new Error("Unknown settings section");
  return section.id;
}

export type SettingEntry = Readonly<{
  id: string;
  section: SettingsSection;
  label: string;
  detail?: string;
  keywords?: string;
  /** When a change takes effect; absent means now. */
  applies?: SettingApplies;
  /** The tool whose options hold this control; it shows only while that tool is on. */
  tool?: GlobalTool;
}>;

const KEYS = "keys shortcut hotkey keyboard";

const toolEntry = (tool: GlobalTool): SettingEntry => {
  const { label, description, action } = TOOL_PRESENTATION[tool];
  return { id: `tool:${tool}`, section: "tools", label, detail: description, keywords: [TOOL_KEYWORDS[tool], action && KEYS].filter(Boolean).join(" ") };
};
const game = (key: keyof typeof GAME_SETTINGS): SettingEntry => ({ id: key, section: "game", ...GAME_SETTINGS[key] });
/** A feature setting, under the label and help its manifest gives it. */
const feature = (key: FeatureSettingKey) => {
  const { label, help } = featureSettingText(key);
  return { id: key, label, detail: help };
};
const option = (tool: GlobalTool, entries: readonly { key: FeatureSettingKey }[], keywords: string): SettingEntry[] =>
  entries.map(({ key }) => ({ ...feature(key), section: "tools", keywords, tool }));

/** Every setting a player can find by name, in display order within its section. */
export const SETTINGS: readonly SettingEntry[] = [
  { id: "hub", section: "tools", label: "Hub", detail: "Search everything in game. Always on, also in the plain game.", keywords: `search command palette ${KEYS}` },
  { ...feature("gwonmacTools"), section: "tools", keywords: "plain vanilla original official features optional tools beta enable disable all off" },
  ...GLOBAL_TOOLS.map(toolEntry),
  ...option("character-switch", CHARACTER_DETAILS, "character details"),
  ...option("chat-filters", CHAT_FILTERS, "chat filter spam"),
  ...option("reminders", [...REMINDER_GROUPS, ...REMINDER_TIMING, REMINDER_SOUND], "reminder"),
  { ...feature("skillCooldownColor"), section: "tools", tool: "skill-cooldowns", keywords: "skill cooldown colour" },
  { ...feature("alcoholTimerPosition"), section: "tools", tool: "alcohol-timer", keywords: "move reset position" },
  { ...feature("targetReadoutPosition"), section: "tools", tool: "target-readout", keywords: "move drag reset position" },
  { ...feature("whispersIcon"), section: "tools", tool: "whispers", keywords: "hide whisper button icon unread" },
  { ...feature("whispersIconPosition"), section: "tools", tool: "whispers", keywords: "move drag reset whisper icon position" },
  { ...feature("skillKeyBindings"), section: "tools", tool: "skill-key-labels", keywords: "skill key labels bindings" },

  { ...feature("cartographyGridEnabled"), section: "maps", keywords: `cartographer explore ${KEYS}` },
  { ...feature("cartographyCompassGridEnabled"), section: "maps", keywords: "unexplored cells" },
  { ...feature("compassRangeIndicatorsEnabled"), section: "maps", keywords: "earshot shout cast casting spirit aggro rings" },
  { ...feature("cartographyRouteEnabled"), section: "maps", keywords: `path navigate waypoint target ${KEYS}` },
  { ...feature("cartographyQuestRouteEnabled"), section: "maps", keywords: "quest objective marker path" },
  { ...feature("cartographyOverlayEnabled"), section: "maps", keywords: `walkability ${KEYS}` },
  { ...feature("eliteSkillsEnabled"), section: "maps", keywords: "elite capture hunt boss signet" },
  { ...feature("eliteMissionMapMarkers"), section: "maps", keywords: "elite hunt" },
  { ...feature("cartographyPresetLibrary"), section: "maps", keywords: "colors theme cartographer" },
  { id: "cartographyBoundaryWidth", section: "maps", label: "Terrain border thickness", keywords: "outline" },
  { ...feature("cartographyGridOpacity"), section: "maps", keywords: "transparency" },
  { ...feature("cartographyRevealMode"), section: "maps", keywords: "explore stand diamonds" },
  { ...feature("cartographyWalkabilityOpacity"), section: "maps", keywords: "transparency" },
  { ...feature("compassButtonsShown"), section: "maps", keywords: "hide compass buttons controls map" },
  { ...feature("compassButtonsOffset"), section: "maps", keywords: "move drag reset compass buttons" },
  { ...feature("cartographyControlIdleOpacity"), section: "maps", keywords: "compass opacity idle" },

  { id: "uiStyle", section: "appearance", label: "Panel style", keywords: "theme modern classic look custom colors colours" },
  { id: "uiFont", section: "appearance", label: "Panel font", keywords: "text typeface" },
  { id: "uiTextSize", section: "appearance", label: "Text size", keywords: "scale zoom bigger larger" },
  { id: "uiPanelOpacity", section: "appearance", label: "Panel opacity", keywords: "transparency" },

  game("renderScale"),
  game("autoRelogAfterReload"),
  game("controllerPromptStyle"),
  game("disableSteamLogin"),
  game("pasteCleanup"),
  game("hubCalculators"),
  game("showDiagnostics"),

  { id: "autoCheckUpdates", section: "updates", label: "Automatically check for launcher updates", keywords: "automatic update" },

  { id: "content.simple", section: "home", label: "Simple launcher", keywords: "minimal accounts only hide home news help start page" },
  { id: "content.news", section: "home", label: "News", keywords: "home news" },
  { id: "content.dailies", section: "home", label: "Dailies", keywords: "daily weekly schedule" },

  { id: "openLogs", section: "advanced", label: "Open logs", keywords: "logs diagnostics support bug" },
  { id: "copySettings", section: "advanced", label: "Copy settings", keywords: "export backup move transfer another mac computer share" },
  { id: "pasteSettings", section: "advanced", label: "Paste settings", keywords: "import restore move transfer another mac computer" },
  { id: "resetAllSettings", section: "advanced", label: "Reset all app settings", keywords: "reset defaults" },
];

export type SettingsTarget = Readonly<{ section: SettingsSection; control?: string }>;

/** Validates a deep link from another window: a known section, and a control of that section. */
export function parseSettingsTarget(value: unknown): SettingsTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid settings target");
  const { section, control, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length) throw new Error("Invalid settings target");
  const parsed = parseSettingsSection(section);
  if (control === undefined) return { section: parsed };
  if (!SETTINGS.some(entry => entry.id === control && entry.section === parsed)) throw new Error("Unknown setting");
  return { section: parsed, control: control as string };
}

/**
 * Settings whose label, words, description or section contain every typed word, best
 * first: a label that starts with the query, then a label that contains it, then the rest.
 */
export function searchSettings(query: string): SettingEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const phrase = words.join(" ");
  const sectionLabel = (entry: SettingEntry) => SETTINGS_SECTIONS.find(section => section.id === entry.section)!.label;
  const rank = (entry: SettingEntry) => {
    const label = entry.label.toLowerCase();
    return label.startsWith(phrase) ? 0 : label.includes(phrase) ? 1 : 2;
  };
  return SETTINGS
    .filter(entry => {
      const text = `${entry.label} ${entry.keywords ?? ""} ${entry.detail ?? ""} ${sectionLabel(entry)}`.toLowerCase();
      return words.every(word => text.includes(word));
    })
    .map((entry, order) => ({ entry, order, rank: rank(entry) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ entry }) => entry);
}
