import { CARTOGRAPHY_OPACITY_MAX, CARTOGRAPHY_OPACITY_MIN } from "../../shared/cartography-overlay.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

const MAP_LAYER = { hub: true, rendererWritable: true } as const;
const cartographyOpacity = (fallback: number, label: string, help: string) => setting.integer(
  fallback,
  { min: CARTOGRAPHY_OPACITY_MIN, max: CARTOGRAPHY_OPACITY_MAX },
  { ...MAP_LAYER, label, help, keywords: "transparency", unit: "%" },
);

/**
 * The walking route and the walkable-terrain shade. Both draw with the map engine in
 * app/features/cartography (its renderer and game part), which runs while any map Feature is on.
 */
export default defineFeature({
  id: "walkingRoute",
  name: "Walking route",
  summary: "Draws a line along walkable ground to a point you set on the map.",
  kind: "around",
  presence: "screen",
  icon: "route",
  version: "1.0",
  settings: {
    /** Walking route's switch. On by default: nothing draws until the player sets a target. Released apps stored it as a Maps layer. */
    cartographyRouteEnabled: featureSwitch(true, { rendererWritable: true, tools: true, keywords: "path navigate waypoint target keys shortcut hotkey keyboard" }),
    /** Show certified walkability on the native Compass and Mission Map. */
    cartographyOverlayEnabled: setting.boolean(false, {
      ...MAP_LAYER,
      tools: true,
      label: "Walkable terrain",
      help: "Shades the areas you cannot walk on, on the Compass and the Mission Map.",
      keywords: "walkability keys shortcut hotkey keyboard",
    }),
    /** Walkability veil and boundary strength, as a whole percentage. */
    cartographyWalkabilityOpacity: cartographyOpacity(55, "Walkable terrain opacity", "How strongly the terrain shade and its border show."),
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
    }),
  },
  region: "pve",
  uses: ["cartography"],
  tool: { id: "walking-route", keywords: "route path walkable terrain" },
  hub: {
    command: "walking-route", order: 7,
    row: { detail: "A line along walkable ground to a point you set", iconKind: "maps", action: "Adjust the route", open: { featurePage: true } },
  },
  shortcuts: [
    { action: "cartography.route.toggle", binding: null, label: "Walking route" },
    { action: "cartography.walkability.toggle", binding: null, label: "Walkable terrain" },
  ],
  shots: [],
  parts: [],
});
