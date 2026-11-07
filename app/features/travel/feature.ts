import { setting } from "../../shared/settings/define.js";
import {
  DEFAULT_STORED_TRAVEL_SHORTCUTS,
  isStoredTravelShortcuts,
  type StoredTravelShortcuts,
} from "../../shared/travel.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "travel",
  settings: {
    /** Allow the focused Travel palette and its explicit map command. */
    travelPalette: setting.boolean(true, { tools: true }),
    /** Ordered destinations for the palette's direct 1–9 shortcuts. */
    travelShortcuts: setting.value(
      DEFAULT_STORED_TRAVEL_SHORTCUTS,
      (value): StoredTravelShortcuts | undefined => isStoredTravelShortcuts(value)
        ? value.map((shortcut) => shortcut === null ? null : { ...shortcut })
        : undefined,
      { error: "settings.travelShortcuts has invalid destinations" },
    ),
  },
  activation: { kind: "setting", setting: "travelPalette", master: "gwonmacTools" },
  region: "pve",
  programs: ["toolbox-commands", "xunlai-storage"],
  optInWithTools: true,
  tool: {
    id: "quick-travel",
    label: "Travel",
    description: "Search destinations and travel between outposts.",
    keywords: "travel outposts map progress vanquish cartographer",
    hub: { command: "travel", order: 0, keyOrder: 0 },
  },
  shortcuts: [{ action: "travel.open", binding: { key: "t", shift: false, option: false }, menuItem: "open-travel" }],
});
