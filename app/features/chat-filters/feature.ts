import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "chatFilters",
  settings: {
    /** Enable the certified in-client filter for selected system chat notices. */
    chatFiltersEnabled: setting.boolean(false, { tools: true }),
    /** Hide item-drop notices assigned to another party member. */
    chatFilterAllyDrops: setting.boolean(true, { hub: true, tools: true }),
    /** Hide global Hall of Heroes winner announcements. */
    chatFilterHallOfHeroes: setting.boolean(true, { hub: true, tools: true }),
    /** Hide player title-achievement announcements. */
    chatFilterTitleAchievements: setting.boolean(true, { hub: true, tools: true }),
  },
  activation: { kind: "setting", setting: "chatFiltersEnabled", master: "gwonmacTools" },
  region: "non-pvp",
  tool: {
    id: "chat-filters",
    label: "Chat Filters",
    description: "Hide selected system notices before they enter chat.",
    keywords: "chat filter spam",
  },
});
