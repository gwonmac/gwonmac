import { setting } from "../../shared/settings/define.js";
import {
  DEFAULT_STORED_TRAVEL_SHORTCUTS,
  isStoredTravelShortcuts,
  type StoredTravelShortcuts,
} from "../../shared/travel.js";
import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "travel",
  name: "Travel",
  summary: "Search destinations and travel between outposts.",
  kind: "around",
  presence: "tool",
  icon: "map-pin",
  version: "1.0",
  settings: {
    /** Allow the focused Travel palette and its explicit map command. */
    travelPalette: featureSwitch(true, { tools: true }),
    /** Ordered destinations for the palette's direct 1–9 shortcuts. */
    travelShortcuts: setting.value(
      DEFAULT_STORED_TRAVEL_SHORTCUTS,
      (value): StoredTravelShortcuts | undefined => isStoredTravelShortcuts(value)
        ? value.map((shortcut) => shortcut === null ? null : { ...shortcut })
        : undefined,
      {
        error: "settings.travelShortcuts has invalid destinations",
        label: "Travel favourites",
        help: "The places the number keys 1 to 9 select in Travel. Save one with Command and its number.",
      },
    ),
  },
  region: "pve",
  uses: ["travelAction"],
  programs: ["toolbox-commands", "xunlai-storage"],
  optInWithTools: true,
  tool: {
    id: "quick-travel",
    keywords: "travel outposts map progress vanquish cartographer",
  },
  hub: { command: "travel", order: 0, keyOrder: 0 },
  shortcuts: [{ action: "travel.open", binding: { key: "t", shift: false, option: false }, menuItem: "open-travel" }],
  /**
   * Hub people and party invites travel to a friend's outpost; its shortcut and menu item open
   * Travel through `toggle`; Progress shows its state on the page Travel's Hub app hosts
   * (shared/link.ts).
   */
  offers: ["friendTripBlocked", "toFriend", "toggle", "showProgress"],
  shots: [],
  parts: ["game", "main"],
});
