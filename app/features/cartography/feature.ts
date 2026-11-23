import {
  CARTOGRAPHY_CONTROL_IDLE_OPACITY_MAX,
  CARTOGRAPHY_CONTROL_IDLE_OPACITY_MIN,
  CARTOGRAPHY_OPACITY_MAX,
  CARTOGRAPHY_OPACITY_MIN,
  CARTOGRAPHY_REVEAL_MODE_LABELS,
  CARTOGRAPHY_REVEAL_MODES,
  DEFAULT_CARTOGRAPHY_PRESET_LIBRARY,
  normaliseCartographyPresetLibrary,
  type CartographyPresetLibrary,
} from "../../shared/cartography-overlay.js";
import {
  COMPASS_RANGE_OPACITY_MAX,
  COMPASS_RANGE_OPACITY_MIN,
  COMPASS_RANGE_THEMES,
  DEFAULT_COMPASS_RANGE_OPACITY,
} from "../../shared/compass-ranges.js";
import { ELITE_MISSION_MAP_MARKER_LABELS, ELITE_MISSION_MAP_MARKERS } from "../../shared/elite-map-settings.js";
import { NO_OVERLAY_OFFSET, readOverlayOffset, type OverlayOffset } from "../../shared/overlay-placement.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

const MAP_LAYER = { hub: true, rendererWritable: true } as const;
const rangeShown = (range: string) => setting.boolean(true, {
  ...MAP_LAYER,
  label: `${range} range`,
  help: `Draws the ${range} range ring while Compass ranges are on.`,
});
const rangeOpacity = (range: string) => setting.integer(
  DEFAULT_COMPASS_RANGE_OPACITY,
  { min: COMPASS_RANGE_OPACITY_MIN, max: COMPASS_RANGE_OPACITY_MAX },
  { ...MAP_LAYER, label: `${range} range opacity`, help: `How strongly the ${range} range ring shows.`, unit: "%" },
);
const cartographyOpacity = (fallback: number, label: string, help: string) => setting.integer(
  fallback,
  { min: CARTOGRAPHY_OPACITY_MIN, max: CARTOGRAPHY_OPACITY_MAX },
  { ...MAP_LAYER, label, help, keywords: "transparency", unit: "%" },
);

export default defineFeature({
  id: "cartography",
  name: "Maps",
  summary: "Exploration grid, walkable terrain, a walking route and Compass ranges on supported PvE maps.",
  kind: "around",
  presence: "screen",
  icon: "map",
  settings: {
    /** Enable map guidance and its controls without changing saved layer visibility. */
    cartographyEnabled: featureSwitch(true, { tools: true }),
    /** Show certified walkability on the native Compass and Mission Map. */
    cartographyOverlayEnabled: setting.boolean(false, {
      ...MAP_LAYER,
      tools: true,
      label: "Walkable terrain",
      help: "Shades the areas you cannot walk on, on the Compass and the Mission Map.",
      keywords: "walkability keys shortcut hotkey keyboard",
    }),
    /** Draw the game's fixed cartography cells over both native map surfaces. */
    cartographyGridEnabled: setting.boolean(false, {
      ...MAP_LAYER,
      tools: true,
      label: "Exploration grid",
      help: "Shows remaining exploration on the Mission Map and World Map.",
      keywords: "cartographer explore keys shortcut hotkey keyboard",
    }),
    /** Draw the walking route to the point the player sets on the Mission Map or World Map. On by
     * default: nothing draws until the player sets a target. */
    cartographyRouteEnabled: setting.boolean(true, {
      ...MAP_LAYER,
      tools: true,
      label: "Walking route",
      help: "Draws a line along walkable ground to the point you set. Right-click the Mission Map or World Map to set or remove it.",
      keywords: "path navigate waypoint target keys shortcut hotkey keyboard",
    }),
    /** Without the player's own target, lead the walking route to the active quest's marker. In
     * development: a tester found it unpolished, so only development builds show it; its README
     * lines wait in STAGED.md. */
    cartographyQuestRouteEnabled: setting.boolean(true, {
      stage: "dev",
      hub: true,
      tools: true,
      label: "Route to quest",
      help: "Without your own target, the walking route leads to your active quest.",
      keywords: "quest objective marker path",
      dependsOn: "cartographyRouteEnabled",
    }),
    /** Include the Compass in exploration-grid presentation; off by default. */
    cartographyCompassGridEnabled: setting.boolean(false, {
      hub: true,
      label: "Markers on Compass",
      help: "Adds nearby unexplored cells to the Compass.",
      keywords: "unexplored cells",
      dependsOn: "cartographyGridEnabled",
    }),
    /** Draw standard Guild Wars ranges around the player on the Compass. */
    compassRangeIndicatorsEnabled: setting.boolean(false, {
      ...MAP_LAYER,
      tools: true,
      label: "Compass ranges",
      help: "Draws range rings around you on the Compass.",
      keywords: "earshot shout cast casting spirit aggro rings",
    }),
    compassRangeEarshotEnabled: rangeShown("Shout"),
    compassRangeCastEnabled: rangeShown("Cast"),
    compassRangeSpiritEnabled: rangeShown("Spirit"),
    compassRangeSpiritExtendedEnabled: rangeShown("Ext. Spirit"),
    compassRangeEarshotOpacity: rangeOpacity("Shout"),
    compassRangeCastOpacity: rangeOpacity("Cast"),
    compassRangeSpiritOpacity: rangeOpacity("Spirit"),
    compassRangeSpiritExtendedOpacity: rangeOpacity("Ext. Spirit"),
    /** Shared color treatment for all standard Compass range rings. */
    compassRangeTheme: setting.enum(COMPASS_RANGE_THEMES, "color", {
      ...MAP_LAYER,
      launcherError: "Compass range theme is invalid",
      label: "Range colors",
      dependsOn: "compassRangeIndicatorsEnabled",
      help: "Color gives each ring its own color. Monochrome draws every ring in white.",
      keywords: "compass ranges rings appearance monochrome",
      choices: { color: "Color", monochrome: "Monochrome" },
    }),
    /** Persistent Compass footprint; Mission Map hover uses Shift or Option+Shift. */
    cartographyRevealMode: setting.enum(CARTOGRAPHY_REVEAL_MODES, "off", {
      ...MAP_LAYER,
      launcherError: "cartography reveal mode is invalid",
      label: "Reveal range",
      help: "Shows on the Compass the area your position reveals: Normal 3×3 or Bird’s Eye 7×7.",
      keywords: "explore stand diamonds",
      choices: {
        off: CARTOGRAPHY_REVEAL_MODE_LABELS.off.label,
        normal: CARTOGRAPHY_REVEAL_MODE_LABELS.normal.label,
        "birds-eye": CARTOGRAPHY_REVEAL_MODE_LABELS["birds-eye"].label,
      },
    }),
    /** Active built-in or player-owned appearance and all custom presets. */
    cartographyPresetLibrary: setting.value(
      DEFAULT_CARTOGRAPHY_PRESET_LIBRARY,
      (value): CartographyPresetLibrary | undefined => normaliseCartographyPresetLibrary(value) ?? undefined,
      {
        hub: true,
        launcherError: "cartography preset library is invalid",
        label: "Map style",
        help: "The colors of every map layer: Cartographer, Synthwave, Monochrome or a style of your own.",
        keywords: "colors theme cartographer",
      },
    ),
    /** Walkability veil and boundary strength, as a whole percentage. */
    cartographyWalkabilityOpacity: cartographyOpacity(55, "Walkable terrain opacity", "How strongly the terrain shade and its border show."),
    /** Grid, reveal ranges, and unseen-cell strength, as a whole percentage. */
    cartographyGridOpacity: cartographyOpacity(65, "Grid opacity", "How strongly the grid, the reveal range and unexplored cells show."),
    /** Visibility of the collapsed Compass control, as a whole percentage. */
    cartographyControlIdleOpacity: setting.integer(
      35,
      { min: CARTOGRAPHY_CONTROL_IDLE_OPACITY_MIN, max: CARTOGRAPHY_CONTROL_IDLE_OPACITY_MAX },
      {
        hub: true,
        label: "Compass control visibility",
        help: "How visible the closed Compass control is while you do not use it.",
        keywords: "compass opacity idle",
        unit: "%",
      },
    ),
    /** Draw the two buttons beside the Compass; every choice they offer is also on the Maps page. */
    compassButtonsShown: setting.boolean(true, {
      hub: true,
      label: "Show compass buttons",
      help: "Shows the two buttons beside the Compass. Every choice they offer is also on this page.",
      keywords: "hide compass buttons controls map",
    }),
    /** How far the player dragged the Compass buttons from their place beside the Compass, in pixels. */
    compassButtonsOffset: setting.position(
      NO_OVERLAY_OFFSET,
      (value): OverlayOffset | undefined => readOverlayOffset(value),
      {
        ...MAP_LAYER,
        error: "Compass buttons position is invalid",
        launcherError: "Compass buttons position is invalid",
        label: "Compass buttons position",
        help: "Drag a button in a game window to move both. Put back returns them beside the Compass.",
        keywords: "move drag reset compass buttons",
      },
    ),
    /** Show the Elite Skills planner and its map markers while Maps are on. */
    eliteSkillsEnabled: setting.boolean(true, {
      ...MAP_LAYER,
      tools: true,
      label: "Elite skill planner",
      help: "Adds the planner to the World Map and your Hunt list to the Mission Map.",
      keywords: "elite capture hunt boss signet",
    }),
    /** Capture locations that the Mission Map shows during play. */
    eliteMissionMapMarkers: setting.enum(ELITE_MISSION_MAP_MARKERS, "saved", {
      ...MAP_LAYER,
      tools: true,
      launcherError: "Mission Map markers are invalid",
      label: "Mission Map markers",
      help: "Which boss markers the Mission Map shows: your Hunt list, all planner matches, or none.",
      keywords: "elite hunt",
      choices: ELITE_MISSION_MAP_MARKER_LABELS,
      dependsOn: "eliteSkillsEnabled",
    }),
  },
  region: "pve",
  /** Every layer runs on the certified Cartography stage: a refused stage turns Maps off with a reason. */
  uses: ["cartography"],
  tool: {
    id: "maps",
    keywords: "grid terrain compass opacity",
  },
  hub: {
    command: "maps", order: 6,
    row: { detail: "Exploration grid, walkable terrain, walking route and Compass ranges", iconKind: "maps", action: "Adjust maps", open: { featurePage: true } },
  },
  shortcuts: [
    { action: "cartography.grid.toggle", binding: null, label: "Exploration grid" },
    { action: "cartography.walkability.toggle", binding: null, label: "Walkable terrain" },
    { action: "cartography.route.toggle", binding: null, label: "Walking route" },
  ],
  /** The Build Library shows where an elite skill can be captured (shared/link.ts). */
  offers: ["findElite"],
  shots: [],
  parts: ["game", "main"],
});
