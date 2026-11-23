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
import { NO_OVERLAY_OFFSET, readOverlayOffset, type OverlayOffset } from "../../shared/overlay-placement.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

const MAP_LAYER = { hub: true, rendererWritable: true } as const;
const cartographyOpacity = (fallback: number, label: string, help: string) => setting.integer(
  fallback,
  { min: CARTOGRAPHY_OPACITY_MIN, max: CARTOGRAPHY_OPACITY_MAX },
  { ...MAP_LAYER, label, help, keywords: "transparency", unit: "%" },
);

export default defineFeature({
  id: "cartography",
  name: "Exploration grid",
  summary: "Shows what is left to explore on the Mission Map and World Map.",
  kind: "around",
  presence: "screen",
  icon: "map",
  settings: {
    /** The Exploration grid's switch: the game's fixed cartography cells on the Mission Map and World Map. Released apps stored it as a Maps layer. */
    cartographyGridEnabled: featureSwitch(false, { rendererWritable: true, tools: true, keywords: "cartographer explore keys shortcut hotkey keyboard" }),
    /** Include the Compass in exploration-grid presentation; off by default. */
    cartographyCompassGridEnabled: setting.boolean(false, {
      hub: true,
      label: "Markers on Compass",
      help: "Adds nearby unexplored cells to the Compass.",
      keywords: "unexplored cells",
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
  },
  region: "pve",
  /**
   * Every map layer runs on the certified Cartography stage: a refused stage turns it off with a
   * reason. This folder also holds the map engine that Walking route, Compass ranges and the Elite
   * Skill Planner draw with; it runs while any of them is on (MAP_FEATURES).
   */
  uses: ["cartography"],
  tool: {
    id: "maps",
    keywords: "maps grid cartographer explore opacity",
  },
  hub: {
    command: "maps", order: 6,
    row: { detail: "Remaining exploration on the Mission Map and World Map", iconKind: "maps", action: "Adjust the grid", open: { featurePage: true } },
  },
  shortcuts: [
    { action: "cartography.grid.toggle", binding: null, label: "Exploration grid" },
  ],
  shots: [],
  parts: ["game", "main"],
});
