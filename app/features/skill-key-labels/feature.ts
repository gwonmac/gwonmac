import { setting } from "../../shared/settings/define.js";
import {
  EMPTY_SKILL_KEY_BINDINGS,
  cloneSkillKeyBindings,
  isSkillKeyBindings,
  type SkillKeyBindings,
} from "../../shared/skill-key-bindings.js";
import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "skillKeyLabels",
  name: "Skill Key Labels",
  summary: "Show your own control labels on the eight skill slots.",
  kind: "fight",
  presence: "screen",
  icon: "keyboard",
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
        label: "Skill labels",
        help: "The key name drawn on each of the eight slots. It does not change your Guild Wars controls.",
        keywords: "skill key labels bindings",
      },
    ),
    /** Show the configured skill-key labels over the eight player skill slots. */
    skillKeyLabelsEnabled: featureSwitch(false, { tools: true }),
  },
  region: "pve",
  uses: ["nativeHudRendering", "skillSlotGeometry"],
  tool: {
    id: "skill-key-labels",
  },
  shots: [],
  // Drawn by the skill HUD substrate (app/renderer/tools-companion-substrates.ts) until Phase 5 moves it.
  parts: ["game"],
});
