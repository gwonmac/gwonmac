import { ELITE_MISSION_MAP_MARKER_LABELS, ELITE_MISSION_MAP_MARKERS } from "../../shared/elite-map-settings.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

const MAP_LAYER = { hub: true, rendererWritable: true } as const;

/**
 * The elite skill planner on the World Map and the Hunt list on the Mission Map. Its code lives
 * with the map engine in app/features/cartography, whose game part provides this Feature's link.
 */
export default defineFeature({
  id: "eliteSkills",
  name: "Elite Skill Planner",
  summary: "Plan which elite skills to capture and see their bosses on the World Map.",
  kind: "party",
  presence: "screen",
  icon: "star",
  version: "1.0",
  settings: {
    /** The Elite Skill Planner's switch. Released apps stored it as a Maps layer. */
    eliteSkillsEnabled: featureSwitch(true, { rendererWritable: true, tools: true, keywords: "elite capture hunt boss signet" }),
    /** Capture locations that the Mission Map shows during play. */
    eliteMissionMapMarkers: setting.enum(ELITE_MISSION_MAP_MARKERS, "saved", {
      ...MAP_LAYER,
      tools: true,
      launcherError: "Mission Map markers are invalid",
      label: "Mission Map markers",
      help: "Which boss markers the Mission Map shows: your Hunt list, all planner matches, or none.",
      keywords: "elite hunt",
      choices: ELITE_MISSION_MAP_MARKER_LABELS,
    }),
  },
  region: "pve",
  uses: ["cartography"],
  tool: { id: "elite-skills", keywords: "elite capture hunt boss" },
  hub: {
    command: "elite-skills", order: 9,
    row: { detail: "Elite skills to capture, on the World Map", iconKind: "builds", action: "Adjust the planner", open: { featurePage: true } },
  },
  /** The Build Library shows where an elite skill can be captured (app/features/cartography/shared/link.ts). */
  offers: ["findElite"],
  shots: [],
  parts: [],
});
