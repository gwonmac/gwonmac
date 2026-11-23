import {
  COMPASS_RANGE_OPACITY_MAX,
  COMPASS_RANGE_OPACITY_MIN,
  COMPASS_RANGE_THEMES,
  DEFAULT_COMPASS_RANGE_OPACITY,
} from "../../shared/compass-ranges.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

const MAP_LAYER = { hub: true, rendererWritable: true } as const;
const rangeShown = (range: string) => setting.boolean(true, {
  ...MAP_LAYER,
  label: `${range} range`,
  help: `Draws the ${range} range ring on the Compass.`,
});
const rangeOpacity = (range: string) => setting.integer(
  DEFAULT_COMPASS_RANGE_OPACITY,
  { min: COMPASS_RANGE_OPACITY_MIN, max: COMPASS_RANGE_OPACITY_MAX },
  { ...MAP_LAYER, label: `${range} range opacity`, help: `How strongly the ${range} range ring shows.`, unit: "%" },
);

/** Range rings on the Compass. They draw with the map engine in app/features/cartography. */
export default defineFeature({
  id: "compassRanges",
  name: "Compass ranges",
  summary: "Draws range rings around you on the Compass: shout, cast and spirit range.",
  kind: "fight",
  presence: "screen",
  icon: "radar",
  settings: {
    /** Compass ranges' switch: the standard Guild Wars ranges around the player on the Compass. Released apps stored it as a Maps layer. */
    compassRangeIndicatorsEnabled: featureSwitch(false, { rendererWritable: true, tools: true, keywords: "earshot shout cast casting spirit aggro rings" }),
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
      help: "Color gives each ring its own color. Monochrome draws every ring in white.",
      keywords: "compass ranges rings appearance monochrome",
      choices: { color: "Color", monochrome: "Monochrome" },
    }),
  },
  region: "pve",
  uses: ["cartography"],
  tool: { id: "compass-ranges", keywords: "compass rings earshot aggro" },
  hub: {
    command: "compass-ranges", order: 8,
    row: { detail: "Range rings around you on the Compass", iconKind: "target", action: "Adjust the rings", open: { featurePage: true } },
  },
  shots: [],
  parts: [],
});
