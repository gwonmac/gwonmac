import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "resign",
  settings: {
    /** Allow the confirmed PvE resign shortcut when Tools are enabled. */
    resignEnabled: setting.boolean(false, { tools: true }),
  },
  activation: { kind: "setting", setting: "resignEnabled", master: "gwonmacTools" },
  region: "pve",
  tool: {
    id: "resign",
    label: "Resign",
    event: "gw:resign-show",
    description: "Ask before sending /resign in PvE. Enter confirms; Escape cancels.",
  },
  shortcuts: [{ action: "game.resign", binding: null, menuItem: "resign-game" }],
});
