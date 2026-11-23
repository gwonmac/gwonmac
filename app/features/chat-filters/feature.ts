import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

const OPTION = { hub: true, tools: true } as const;

export default defineFeature({
  id: "chatFilters",
  name: "Chat Filters",
  summary: "Hide selected system notices before they enter chat.",
  kind: "chat",
  presence: "background",
  icon: "funnel",
  version: "1.0",
  settings: {
    /** Enable the certified in-client filter for selected system chat notices. */
    chatFiltersEnabled: featureSwitch(false, { tools: true }),
    /** Hide item-drop notices assigned to another party member. */
    chatFilterAllyDrops: setting.boolean(true, {
      ...OPTION,
      label: "Hide other party members' item drops",
      help: "Hides the notice when an item drops for another party member.",
      keywords: "chat filter spam",
    }),
    /** Hide global Hall of Heroes winner announcements. */
    chatFilterHallOfHeroes: setting.boolean(true, {
      ...OPTION,
      label: "Hide Hall of Heroes winner announcements",
      help: "Hides the announcement sent to every player when a team wins the Hall of Heroes.",
      keywords: "chat filter spam",
    }),
    /** Hide player title-achievement announcements. */
    chatFilterTitleAchievements: setting.boolean(true, {
      ...OPTION,
      label: "Hide player title achievements",
      help: "Hides the notice when another player earns a title.",
      keywords: "chat filter spam",
    }),
  },
  region: "non-pvp",
  uses: ["chatFiltering"],
  tool: {
    id: "chat-filters",
    keywords: "chat filter spam",
  },
  shots: [],
  parts: ["game"],
});
