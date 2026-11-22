import { setting } from "../../shared/settings/define.js";
import {
  DEFAULT_SKILL_COOLDOWN_COLOR,
  cloneSkillCooldownColor,
  isSkillCooldownColor,
  type SkillCooldownColor,
} from "../../shared/skill-cooldowns.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "skillCooldowns",
  name: "Skill Cooldowns",
  summary: "Show numeric recharge timers on the skill bar.",
  kind: "combat",
  icon: "timer",
  settings: {
    /** Show Guild Wars' observed recharge state as display-only countdowns. */
    skillCooldownOverlayEnabled: setting.boolean(true, {
      tools: true,
      label: "Skill Cooldowns",
      help: "Shows the seconds left on each recharging skill, with tenths in the last 3 seconds.",
    }),
    /** One curated or exact RGB color shared by all eight cooldown labels. */
    skillCooldownColor: setting.value(
      DEFAULT_SKILL_COOLDOWN_COLOR,
      (value): SkillCooldownColor | undefined => isSkillCooldownColor(value) ? cloneSkillCooldownColor(value) : undefined,
      {
        hub: true,
        tools: true,
        error: "settings.skillCooldownColor has an invalid color",
        launcherError: "Cooldown color is invalid",
        label: "Timer color",
        help: "One color for all eight timers: a preset or your own.",
      },
    ),
  },
  activation: { kind: "setting", setting: "skillCooldownOverlayEnabled", master: "gwonmacTools" },
  region: "pve",
  uses: ["nativeHudRendering", "skillSlotGeometry", "skillCooldownObservation"],
  tool: {
    id: "skill-cooldowns",
    keywords: "recharge timer skill bar",
  },
  shots: [],
  parts: ["game"],
});
