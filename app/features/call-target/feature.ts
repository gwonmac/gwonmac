import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "callTarget",
  settings: {
    /** Opt-in Command shortcut for the default target-call chord. */
    callTargetEnabled: setting.boolean(false, { tools: true }),
  },
  activation: { kind: "setting", setting: "callTargetEnabled", master: "gwonmacTools" },
  region: "any",
  tool: {
    id: "call-target",
    label: "Call target",
    description: "Call the selected target without attacking. Sends Control-Shift-Space and requires Guild Wars’ default controls. Inactive while typing.",
    keywords: "call target attack",
  },
  shortcuts: [{ action: "game.call-target", binding: { key: "g", shift: false, option: false } }],
});
