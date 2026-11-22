import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

const OPTION = { hub: true, tools: true } as const;

export default defineFeature({
  id: "chatFilters",
  name: "Chat Filters",
  summary: "Hide selected system notices before they enter chat.",
  kind: "chat",
  purpose: "talk",
  icon: "funnel",
  settings: {
    /** Enable the certified in-client filter for selected system chat notices. */
    chatFiltersEnabled: setting.boolean(false, {
      tools: true,
      label: "Chat Filters",
      help: "Hides the notices you choose below before they reach your chat log.",
    }),
    /** Hide item-drop notices assigned to another party member. */
    chatFilterAllyDrops: setting.boolean(true, {
      ...OPTION,
      label: "Hide other party members' item drops",
      help: "Hides the notice when an item drops for another party member.",
    }),
    /** Hide global Hall of Heroes winner announcements. */
    chatFilterHallOfHeroes: setting.boolean(true, {
      ...OPTION,
      label: "Hide Hall of Heroes winner announcements",
      help: "Hides the notice to everyone when a team wins the Hall of Heroes.",
    }),
    /** Hide player title-achievement announcements. */
    chatFilterTitleAchievements: setting.boolean(true, {
      ...OPTION,
      label: "Hide player title achievements",
      help: "Hides the notice when another player earns a title.",
    }),
  },
  activation: { kind: "setting", setting: "chatFiltersEnabled", master: "gwonmacTools" },
  region: "non-pvp",
  uses: ["chatFiltering"],
  tool: {
    id: "chat-filters",
    keywords: "chat filter spam",
  },
  shots: [],
  parts: ["game"],
});
