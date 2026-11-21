import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "characterSwitch",
  settings: {
    /** Character Switch's own switch; the plain game (`gwonmacTools` off) stops it too. */
    characterSwitchEnabled: setting.boolean(true, { tools: true }),
    /** Show the canonical profession icon and profession names in Character Switch. */
    characterSwitchProfession: setting.boolean(true, { hub: true, rendererWritable: true }),
    /** Show the character's certified level in Character Switch. */
    characterSwitchLevel: setting.boolean(true, { hub: true, rendererWritable: true }),
    /** Show a location only when Travel's reviewed catalogue names its map. */
    characterSwitchLocation: setting.boolean(true, { hub: true, rendererWritable: true }),
  },
  activation: { kind: "setting", setting: "characterSwitchEnabled", master: "gwonmacTools" },
  region: "any",
  capabilities: ["characterSwitchAction"],
  tool: {
    id: "character-switch",
    label: "Switch Character",
    event: "gw:character-toggle",
    description: "Search and browse every character.",
    keywords: "characters relog alts profession",
    hub: {
      command: "character", order: 1, keyOrder: 1,
      row: { detail: "Choose another character", iconKind: "character", action: "Choose character", open: { page: true } },
    },
  },
  shortcuts: [{ action: "character.switch", binding: { key: "e", shift: false, option: false }, menuItem: "switch-character" }],
});
