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
  settings: {
    /** Show Guild Wars' observed recharge state as display-only countdowns. */
    skillCooldownOverlayEnabled: setting.boolean(true, { tools: true }),
    /** One curated or exact RGB color shared by all eight cooldown labels. */
    skillCooldownColor: setting.value(
      DEFAULT_SKILL_COOLDOWN_COLOR,
      (value): SkillCooldownColor | undefined => isSkillCooldownColor(value) ? cloneSkillCooldownColor(value) : undefined,
      {
        hub: true,
        tools: true,
        error: "settings.skillCooldownColor has an invalid color",
        launcherError: "Cooldown color is invalid",
      },
    ),
  },
  activation: { kind: "setting", setting: "skillCooldownOverlayEnabled", master: "gwonmacTools" },
  region: "pve",
  tool: {
    id: "skill-cooldowns",
    label: "Skill Cooldowns",
    description: "Show numeric recharge timers on the skill bar.",
    keywords: "recharge timer skill bar",
  },
});
