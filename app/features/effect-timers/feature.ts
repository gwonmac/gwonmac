import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "effectTimers",
  name: "Effect Timers",
  summary: "Show exact remaining time on your native Effects icons.",
  kind: "fight",
  presence: "screen",
  icon: "hourglass",
  settings: {
    /** Show exact remaining durations over the controlled player's native Effects icons. */
    effectTimersEnabled: featureSwitch(false, { tools: true }),
  },
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
