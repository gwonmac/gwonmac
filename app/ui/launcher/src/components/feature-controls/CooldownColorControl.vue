<script setup lang="ts">
/** Skill Cooldowns' timer colour on its Feature page: a preset, or a colour of the player's own. */
import { featureSettingText } from "@shared/feature-contracts";
import { SKILL_COOLDOWN_PRESETS, isSkillCooldownCustomHex, skillCooldownCssColor } from "@shared/skill-cooldowns";
import type { InGamePatch, InGameSettings } from "../../settings-host";
import { saveChoice } from "../../select-choice";
import ColorControl from "../ColorControl.vue";

const props = defineProps<{ settings: InGameSettings; save: (patch: InGamePatch) => Promise<void> }>();
const CHOICES = [...SKILL_COOLDOWN_PRESETS, "custom"] as const;
const TEXT = featureSettingText("skillCooldownColor");
/** The page's save note reports a failure; the control keeps showing the saved value. */
const change = (patch: InGamePatch) => props.save(patch).catch(() => undefined);
function customColor(value: string) {
  if (isSkillCooldownCustomHex(value)) void change({ skillCooldownColor: { kind: "custom", value } });
}
</script>

<template>
  <div class="row" data-setting="skillCooldownColor">
    <span class="row-label"><span id="option-skillCooldownColor">{{ TEXT.label }}</span><small id="option-skillCooldownColor-help">{{ TEXT.help }}</small></span>
    <select aria-labelledby="option-skillCooldownColor" aria-describedby="option-skillCooldownColor-help" :value="settings.skillCooldownColor.kind === 'preset' ? settings.skillCooldownColor.preset : 'custom'" @change="saveChoice($event, CHOICES, (choice) => change({ skillCooldownColor: choice === 'custom' ? { kind: 'custom', value: '#e35a4f' } : { kind: 'preset', preset: choice } }))">
      <option v-for="preset in SKILL_COOLDOWN_PRESETS" :key="preset" :value="preset">{{ preset }}</option>
      <option value="custom">Custom</option>
    </select>
  </div>
  <div v-if="settings.skillCooldownColor.kind === 'custom'" class="row">
    <span class="row-label"><span>Custom timer color</span></span>
    <ColorControl label="Custom timer color" :value="skillCooldownCssColor(settings.skillCooldownColor)" @change="customColor" />
  </div>
</template>
