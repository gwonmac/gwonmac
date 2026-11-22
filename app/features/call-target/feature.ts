import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "callTarget",
  name: "Call target",
  summary: "Call the selected target without attacking. Needs Guild Wars’ default controls.",
  kind: "combat",
  icon: "megaphone",
  settings: {
    /** Opt-in Command shortcut for the default target-call chord. */
    callTargetEnabled: setting.boolean(false, {
      tools: true,
      label: "Call target",
      help: "Allows the Call target shortcut. It sends Control-Shift-Space for you, and does nothing while you type.",
    }),
  },
  activation: { kind: "setting", setting: "callTargetEnabled", master: "gwonmacTools" },
  region: "any",
  tool: {
    id: "call-target",
    event: "gw:call-target",
    keywords: "call target attack",
  },
  shortcuts: [{ action: "game.call-target", binding: { key: "g", shift: false, option: false } }],
  shots: [],
  // The fixed key chord needs the input host's held keys (app/renderer/input.ts) until Phase 5 moves it.
  parts: ["game"],
});
