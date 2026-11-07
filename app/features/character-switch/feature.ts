import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "characterSwitch",
  settings: {
    /** Allow the Core Character Switch surface independently of optional Tools. */
    characterSwitchEnabled: setting.boolean(true, { tools: true }),
    /** Show the canonical profession icon and profession names in Character Switch. */
    characterSwitchProfession: setting.boolean(true, { hub: true, rendererWritable: true }),
    /** Show the character's certified level in Character Switch. */
    characterSwitchLevel: setting.boolean(true, { hub: true, rendererWritable: true }),
    /** Show a location only when Travel's reviewed catalogue names its map. */
    characterSwitchLocation: setting.boolean(true, { hub: true, rendererWritable: true }),
  },
  activation: { kind: "independent", setting: "characterSwitchEnabled" },
  region: "any",
  tool: {
    id: "character-switch",
    label: "Switch Character",
    description: "Search and browse every character. Available without optional Tools.",
    keywords: "characters relog alts profession",
    hub: {
      command: "character", order: 1, keyOrder: 1,
      row: { detail: "Choose another character", action: "Choose character", open: { event: "gw:character-toggle", page: true } },
    },
  },
  shortcuts: [{ action: "character.switch", binding: { key: "e", shift: false, option: false }, menuItem: "switch-character" }],
});
