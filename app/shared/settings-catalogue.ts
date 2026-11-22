/**
 * Owns where every setting lives and how a player finds it: its section (and, for a Feature's
 * option, its Feature page), a stable control ID, its label and the words players search with.
 * Settings search and deep links (Hub search, the memory warning) use these IDs; each rendered
 * control carries `data-setting="<id>"`. Labels, descriptions and tool keywords come from their
 * owners (feature manifests, setting-copy, tool-presentation), so a setting has one name
 * everywhere (docs/settings.md): a Feature's option takes its manifest's label and help, word for word.
 */
import { GAME_SETTINGS, type SettingApplies } from "./setting-copy.js";
import { FEATURE_SELECTION_POLICIES, featureSettingText, type FeatureId, type FeatureSettingKey } from "./feature-contracts.js";
import { SWITCH_FEATURES, type SwitchFeature } from "./feature-status.js";
import { SHORTCUT_LABELS } from "./keyboard-shortcuts.js";
import { GLOBAL_TOOLS, GLOBAL_TOOL_FEATURES, type GlobalTool } from "./launcher-contracts.js";
import { LAUNCHER_SETTINGS } from "./settings/index.js";
import { TOOL_KEYWORDS, TOOL_PRESENTATION } from "./tool-presentation.js";

/**
 * Settings sections in sidebar order: game settings first, by how often players change them.
 * `features` is the Features catalog and its Feature pages: the launcher draws it as its own
 * tab, the Hub as the first section of its Settings page.
 */
export const SETTINGS_SECTIONS = [
  { id: "features", label: "Features", group: "game", keywords: "features optional tools maps" },
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
export const HUB_SECTIONS: ReadonlySet<SettingsSection> = new Set(["features", "appearance", "game"]);

export function parseSettingsSection(value: unknown): SettingsSection {
  const section = SETTINGS_SECTIONS.find(candidate => candidate.id === value);
  if (!section) throw new Error("Unknown settings section");
  return section.id;
}

export type SettingEntry = Readonly<{
  id: string;
  section: SettingsSection;
  /** The Feature page that holds this control; absent in `features` means the catalog itself. */
  feature?: FeatureId;
  label: string;
  detail?: string;
  keywords?: string;
  /** When a change takes effect; absent means now. */
  applies?: SettingApplies;
}>;

const KEYS = "keys shortcut hotkey keyboard";

const game = (key: keyof typeof GAME_SETTINGS): SettingEntry => ({ id: key, section: "game", ...GAME_SETTINGS[key] });

/** The extra words search matches for a Feature's option, beyond its label and help. */
const OPTION_KEYWORDS: Readonly<Partial<Record<FeatureSettingKey, string>>> = {
  characterSwitchProfession: "character details", characterSwitchLevel: "character details", characterSwitchLocation: "character details",
  chatFilterAllyDrops: "chat filter spam", chatFilterHallOfHeroes: "chat filter spam", chatFilterTitleAchievements: "chat filter spam",
  reminderCons: "reminder", reminderPcons: "reminder", reminderAlcohol: "reminder", reminderBeforeEnd: "reminder", reminderAtEnd: "reminder", reminderSound: "reminder",
  skillCooldownColor: "skill cooldown colour",
  alcoholTimerPosition: "move reset position",
  targetReadoutPosition: "move drag reset position",
  whispersIcon: "hide whisper button icon unread",
  whispersIconPosition: "move drag reset whisper icon position",
  skillKeyBindings: "skill key labels bindings",
  cartographyGridEnabled: `cartographer explore ${KEYS}`,
  cartographyCompassGridEnabled: "unexplored cells",
  compassRangeIndicatorsEnabled: "earshot shout cast casting spirit aggro rings",
  compassRangeTheme: "compass ranges rings appearance monochrome",
  cartographyRouteEnabled: `path navigate waypoint target ${KEYS}`,
  cartographyQuestRouteEnabled: "quest objective marker path",
  cartographyOverlayEnabled: `walkability ${KEYS}`,
  eliteSkillsEnabled: "elite capture hunt boss signet",
  eliteMissionMapMarkers: "elite hunt",
  cartographyPresetLibrary: "colors theme cartographer",
  cartographyGridOpacity: "transparency",
  cartographyRevealMode: "explore stand diamonds",
  cartographyWalkabilityOpacity: "transparency",
  compassButtonsShown: "hide compass buttons controls map",
  compassButtonsOffset: "move drag reset compass buttons",
  cartographyControlIdleOpacity: "compass opacity idle",
};

const launcherKeys: ReadonlySet<string> = new Set(LAUNCHER_SETTINGS);
/**
 * A Feature's options, in manifest order: every setting it declares that a settings page draws,
 * except its switch, which the card and the page's header move.
 */
export function featureOptionKeys(feature: SwitchFeature): readonly FeatureSettingKey[] {
  const own = FEATURE_SELECTION_POLICIES[feature.id].switch;
  return Object.keys("settings" in feature ? feature.settings : {})
    .filter((key): key is FeatureSettingKey => key !== own && launcherKeys.has(key));
}

/** A Feature's switch: its card, and on its page the button in the header. */
const toolEntry = (tool: GlobalTool): SettingEntry => {
  const { label, description, action } = TOOL_PRESENTATION[tool];
  return { id: `tool:${tool}`, section: "features", feature: GLOBAL_TOOL_FEATURES[tool], label, detail: description, keywords: [TOOL_KEYWORDS[tool], action && KEYS].filter(Boolean).join(" ") };
};
/** A Feature's options and its shortcuts, on its page. */
const featureEntries = (feature: SwitchFeature): SettingEntry[] => [
  ...featureOptionKeys(feature).flatMap((key): SettingEntry[] => {
    const { label, help } = featureSettingText(key);
    const keywords = OPTION_KEYWORDS[key];
    const entry: SettingEntry = { id: key, section: "features", feature: feature.id, label, detail: help, ...(keywords ? { keywords } : {}) };
    // The terrain border is part of the map style, so it is found beside it.
    return key === "cartographyPresetLibrary"
      ? [entry, { id: "cartographyBoundaryWidth", section: "features", feature: feature.id, label: "Terrain border thickness", keywords: "outline" }]
      : [entry];
  }),
  ...("shortcuts" in feature ? feature.shortcuts : []).map(({ action }): SettingEntry => ({
    id: `shortcut:${action}`, section: "features", feature: feature.id, label: `${SHORTCUT_LABELS[action]} shortcut`, keywords: KEYS,
  })),
];

/** Every setting a player can find by name, in display order within its section. */
export const SETTINGS: readonly SettingEntry[] = [
  { ...featureSettingText("gwonmacTools"), detail: featureSettingText("gwonmacTools").help, id: "gwonmacTools", section: "features", keywords: "plain vanilla original official features optional tools beta enable disable all off" },
  ...GLOBAL_TOOLS.map(toolEntry),
  ...SWITCH_FEATURES.flatMap(featureEntries),

  { id: "uiStyle", section: "appearance", label: "Panel style", keywords: "theme modern classic look custom colors colours" },
  { id: "uiFont", section: "appearance", label: "Panel font", keywords: "text typeface" },
  { id: "uiTextSize", section: "appearance", label: "Text size", keywords: "scale zoom bigger larger" },
  { id: "uiPanelOpacity", section: "appearance", label: "Panel opacity", keywords: "transparency" },

  { id: "hub", section: "game", label: "Hub", detail: "Search everything in game. Always on, also in the plain game.", keywords: `search command palette ${KEYS}` },
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

/** Where a player finds a setting, as a few words: "Features › Maps", "Game". */
export function settingPlace(entry: SettingEntry): string {
  const section = SETTINGS_SECTIONS.find(candidate => candidate.id === entry.section)!.label;
  const feature = entry.feature && SWITCH_FEATURES.find(candidate => candidate.id === entry.feature);
  return feature ? `${section} › ${feature.name}` : section;
}

/**
 * Where Settings opens: a section, at a control when named. In `features`, `feature` opens that
 * Feature's page; without it the catalog shows.
 */
export type SettingsTarget = Readonly<{ section: SettingsSection; feature?: FeatureId; control?: string }>;

/** Validates a deep link from another window: a known section and Feature, and a control of that place. */
export function parseSettingsTarget(value: unknown): SettingsTarget {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid settings target");
  const { section, feature, control, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length) throw new Error("Invalid settings target");
  const parsed = parseSettingsSection(section);
  const page = feature === undefined ? undefined : SWITCH_FEATURES.find(candidate => candidate.id === feature && parsed === "features")?.id;
  if (feature !== undefined && page === undefined) throw new Error("Unknown Feature");
  const place = page === undefined ? { section: parsed } : { section: parsed, feature: page };
  if (control === undefined) return place;
  if (!SETTINGS.some(entry => entry.id === control && entry.section === parsed && entry.feature === page)) throw new Error("Unknown setting");
  return { ...place, control: control as string };
}

/** The place a search result opens: its section, its Feature page, its control. */
export function settingTarget(entry: SettingEntry): SettingsTarget {
  return entry.feature ? { section: entry.section, feature: entry.feature, control: entry.id } : { section: entry.section, control: entry.id };
}

/**
 * The place a docs or news link names as `section[/control]`. A control on a Feature page
 * brings its Feature, so a guide names only the control. Throws on an unknown place.
 */
export function settingsLinkTarget(path: string): SettingsTarget {
  const [section, control, ...rest] = path.split("/");
  if (rest.length) throw new Error("Invalid settings link");
  if (control === undefined) return parseSettingsTarget({ section });
  const entry = SETTINGS.find(candidate => candidate.id === control && candidate.section === section);
  if (!entry) throw new Error("Unknown setting");
  return settingTarget(entry);
}

/**
 * Settings whose label, words, description or section contain every typed word, best
 * first: a label that starts with the query, then a label that contains it, then the rest.
 */
export function searchSettings(query: string): SettingEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const phrase = words.join(" ");
  const rank = (entry: SettingEntry) => {
    const label = entry.label.toLowerCase();
    return label.startsWith(phrase) ? 0 : label.includes(phrase) ? 1 : 2;
  };
  return SETTINGS
    .filter(entry => {
      const text = `${entry.label} ${entry.keywords ?? ""} ${entry.detail ?? ""} ${settingPlace(entry)}`.toLowerCase();
      return words.every(word => text.includes(word));
    })
    .map((entry, order) => ({ entry, order, rank: rank(entry) }))
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ entry }) => entry);
}
