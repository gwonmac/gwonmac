import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "callTarget",
  name: "Call Target",
  summary: "Call the selected target without attacking. Needs Guild Wars’ default controls.",
  kind: "fight",
  presence: "action",
  icon: "megaphone",
  version: "1.0",
  settings: {
    /** Opt-in Command shortcut for the default target-call chord. */
    callTargetEnabled: featureSwitch(false, { tools: true }),
  },
  region: "any",
  tool: {
    id: "call-target",
    event: "gw:call-target",
    keywords: "call target attack",
  },
  shortcuts: [{ action: "game.call-target", binding: { key: "g", shift: false, option: false } }],
  shots: [],
  /*
   * Its behaviour stays in the input host (app/renderer/input.ts), which claims `gw:call-target`.
   * The chord is balanced against the keys the player holds: it lifts a held Option, presses only
   * the Control and Shift that are not held, and never runs while Space is held. Only the input
   * host knows the held keys, and it would have to lend them, or a chord sender, to this one
   * Feature: a special case in the input layer (plan step 5.5).
   */
  parts: ["game"],
});
