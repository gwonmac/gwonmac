import {
  CARTOGRAPHY_CONTROL_IDLE_OPACITY_MAX,
  CARTOGRAPHY_CONTROL_IDLE_OPACITY_MIN,
  CARTOGRAPHY_OPACITY_MAX,
  CARTOGRAPHY_OPACITY_MIN,
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
import { isEliteMissionMapMarkers, type EliteMissionMapMarkers } from "../../shared/elite-map-settings.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

const MAP_LAYER = { hub: true, rendererWritable: true } as const;
const compassRangeOpacity = () => setting.integer(
  DEFAULT_COMPASS_RANGE_OPACITY,
  { min: COMPASS_RANGE_OPACITY_MIN, max: COMPASS_RANGE_OPACITY_MAX },
  MAP_LAYER,
);
const cartographyOpacity = (fallback: number) => setting.integer(
  fallback,
  { min: CARTOGRAPHY_OPACITY_MIN, max: CARTOGRAPHY_OPACITY_MAX },
  MAP_LAYER,
);

export default defineFeature({
  id: "cartography",
  settings: {
    /** Enable map guidance and its controls without changing saved layer visibility. */
    cartographyEnabled: setting.boolean(true, { tools: true }),
    /** Show certified walkability on the native Compass and Mission Map. */
    cartographyOverlayEnabled: setting.boolean(false, { ...MAP_LAYER, tools: true }),
    /** Draw the game's fixed cartography cells over both native map surfaces. */
    cartographyGridEnabled: setting.boolean(false, { ...MAP_LAYER, tools: true }),
    /** Include the Compass in exploration-grid presentation; off by default. */
    cartographyCompassGridEnabled: setting.boolean(false, { hub: true }),
    /** Draw standard Guild Wars ranges around the player on the Compass. */
    compassRangeIndicatorsEnabled: setting.boolean(false, { ...MAP_LAYER, tools: true }),
    compassRangeEarshotEnabled: setting.boolean(true, MAP_LAYER),
    compassRangeCastEnabled: setting.boolean(true, MAP_LAYER),
    compassRangeSpiritEnabled: setting.boolean(true, MAP_LAYER),
    compassRangeSpiritExtendedEnabled: setting.boolean(true, MAP_LAYER),
    compassRangeEarshotOpacity: compassRangeOpacity(),
    compassRangeCastOpacity: compassRangeOpacity(),
    compassRangeSpiritOpacity: compassRangeOpacity(),
    compassRangeSpiritExtendedOpacity: compassRangeOpacity(),
    /** Shared color treatment for all standard Compass range rings. */
    compassRangeTheme: setting.enum(COMPASS_RANGE_THEMES, "color", {
      ...MAP_LAYER,
      launcherError: "Compass range theme is invalid",
    }),
    /** Persistent Compass footprint; Mission Map hover uses Shift or Option+Shift. */
    cartographyRevealMode: setting.enum(CARTOGRAPHY_REVEAL_MODES, "off", {
      ...MAP_LAYER,
      launcherError: "cartography reveal mode is invalid",
    }),
    /** Active built-in or player-owned appearance and all custom presets. */
    cartographyPresetLibrary: setting.value(
      DEFAULT_CARTOGRAPHY_PRESET_LIBRARY,
      (value): CartographyPresetLibrary | undefined => normaliseCartographyPresetLibrary(value) ?? undefined,
      { hub: true, launcherError: "cartography preset library is invalid" },
    ),
    /** Walkability veil and boundary strength, as a whole percentage. */
    cartographyWalkabilityOpacity: cartographyOpacity(55),
    /** Grid, reveal ranges, and unseen-cell strength, as a whole percentage. */
    cartographyGridOpacity: cartographyOpacity(65),
    /** Visibility of the collapsed Compass control, as a whole percentage. */
    cartographyControlIdleOpacity: setting.integer(
      35,
      { min: CARTOGRAPHY_CONTROL_IDLE_OPACITY_MIN, max: CARTOGRAPHY_CONTROL_IDLE_OPACITY_MAX },
      { hub: true },
    ),
    /** Show the Elite Skills planner and its map markers while Maps are on. */
    eliteSkillsEnabled: setting.boolean(true, { ...MAP_LAYER, tools: true }),
    /** Capture locations that the Mission Map shows during play. */
    eliteMissionMapMarkers: setting.value(
      "saved",
      (value): EliteMissionMapMarkers | undefined => isEliteMissionMapMarkers(value) ? value : undefined,
      { ...MAP_LAYER, tools: true, launcherError: "Mission Map markers are invalid" },
    ),
  },
  activation: { kind: "setting", setting: "cartographyEnabled", master: "gwonmacTools" },
  region: "pve",
  tool: {
    id: "maps",
    label: "Maps",
    description: "Exploration grid and walkable terrain on supported PvE maps.",
    keywords: "grid terrain compass",
  },
  shortcuts: [
    { action: "cartography.grid.toggle", binding: null, label: "Exploration grid" },
    { action: "cartography.walkability.toggle", binding: null, label: "Walkable terrain" },
  ],
  capabilities: ["targetObservation", "partyObservation"],
});
