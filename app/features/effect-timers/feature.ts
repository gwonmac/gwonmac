import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "effectTimers",
  settings: {
    /** Show exact remaining durations over the controlled player's native Effects icons. */
    effectTimersEnabled: setting.boolean(false, { tools: true }),
  },
  activation: { kind: "setting", setting: "effectTimersEnabled", master: "gwonmacTools" },
  region: "pve",
  programs: ["effect-observer"],
  tool: {
    id: "effect-timers",
    label: "Effect Timers",
    description: "Show exact remaining time on your native Effects icons.",
    keywords: "effects buffs timers",
  },
  capabilities: ["playerEffectObservation", "effectIconGeometry", "nativeHudRendering"],
});
