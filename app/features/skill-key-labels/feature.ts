import { setting } from "../../shared/settings/define.js";
import {
  EMPTY_SKILL_KEY_BINDINGS,
  cloneSkillKeyBindings,
  isSkillKeyBindings,
  type SkillKeyBindings,
} from "../../shared/skill-key-bindings.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "skillKeyLabels",
  settings: {
    /** Display-only labels that mirror the player's eight Guild Wars bindings. */
    skillKeyBindings: setting.value(
      EMPTY_SKILL_KEY_BINDINGS,
      (value): SkillKeyBindings | undefined => isSkillKeyBindings(value) ? cloneSkillKeyBindings(value) : undefined,
      {
        hub: true,
        tools: true,
        error: "settings.skillKeyBindings has invalid bindings",
        launcherError: "Skill key labels are invalid",
      },
    ),
    /** Show the configured skill-key labels over the eight player skill slots. */
    skillKeyLabelsEnabled: setting.boolean(false, { tools: true }),
  },
  activation: { kind: "setting", setting: "skillKeyLabelsEnabled", master: "gwonmacTools" },
  region: "pve",
  tool: {
    id: "skill-key-labels",
    label: "Skill Key Labels",
    description: "Show your own control labels on the eight skill slots.",
  },
});
