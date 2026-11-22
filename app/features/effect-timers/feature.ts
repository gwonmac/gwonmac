import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "effectTimers",
  name: "Effect Timers",
  summary: "Show exact remaining time on your native Effects icons.",
  kind: "combat",
  icon: "hourglass",
  settings: {
    /** Show exact remaining durations over the controlled player's native Effects icons. */
    effectTimersEnabled: setting.boolean(false, {
      tools: true,
      label: "Effect Timers",
      help: "Shows the time left on each icon in your Effects panel. Effects with no end show no number.",
    }),
  },
  activation: { kind: "setting", setting: "effectTimersEnabled", master: "gwonmacTools" },
  region: "pve",
  uses: ["nativeHudRendering", "effectIconGeometry"],
  programs: ["effect-observer"],
  tool: {
    id: "effect-timers",
    keywords: "effects buffs timers",
  },
  shots: [],
  parts: ["game"],
});
