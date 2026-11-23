import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

const DETAIL = { hub: true, rendererWritable: true } as const;

export default defineFeature({
  id: "characterSwitch",
  name: "Switch Character",
  summary: "Search every character and switch to one without logging out.",
  kind: "party",
  presence: "tool",
  icon: "arrow-left-right",
  settings: {
    /** Character Switch's own switch; the plain game (`gwonmacTools` off) stops it too. */
    characterSwitchEnabled: featureSwitch(true, { tools: true }),
    /** Show the canonical profession icon and profession names in Character Switch. */
    characterSwitchProfession: setting.boolean(true, {
      ...DETAIL,
      label: "Show profession",
      help: "Shows each character’s profession icon and profession names.",
      keywords: "character details",
    }),
    /** Show the character's certified level in Character Switch. */
    characterSwitchLevel: setting.boolean(true, {
      ...DETAIL,
      label: "Show level",
      help: "Shows each character’s level.",
      keywords: "character details",
    }),
    /** Show a location only when Travel's reviewed catalogue names its map. */
    characterSwitchLocation: setting.boolean(true, {
      ...DETAIL,
      label: "Show location",
      help: "Shows where each character is, when the map is a known Travel place.",
      keywords: "character details",
    }),
  },
  region: "any",
  uses: ["characterSwitchAction"],
  tool: {
    id: "character-switch",
    keywords: "characters relog alts profession",
  },
  hub: {
    command: "character", order: 1, keyOrder: 1,
    row: { detail: "Choose another character", iconKind: "character", action: "Choose character", open: { page: true } },
  },
  shortcuts: [{ action: "character.switch", binding: { key: "e", shift: false, option: false }, menuItem: "switch-character" }],
  /** ⌘E, its menu item and its Hub row open Characters through `toggle` (shared/link.ts). */
  offers: ["toggle"],
  shots: [],
  parts: ["game", "hubPage"],
});
