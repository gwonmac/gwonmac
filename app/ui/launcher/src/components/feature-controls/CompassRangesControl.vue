<script setup lang="ts">
/**
 * The Compass range rings on the Compass ranges Feature page: each ring's switch and opacity in one
 * row, as the Compass dock shows them in the game. The words come from the manifest.
 */
import { COMPASS_RANGE_INDICATORS } from "@shared/compass-ranges";
import { featureSettingText } from "@shared/feature-contracts";
import type { InGamePatch, InGameSettings } from "../../settings-host";
import FeatureSwitch from "../FeatureSwitch.vue";
import RangeControl from "../RangeControl.vue";

const props = defineProps<{ settings: InGameSettings; save: (patch: InGamePatch) => Promise<void> }>();
/** The page's save status reports a failure; the row shows the saved value again (`undo`). */
const change = (patch: InGamePatch, undo?: () => void) => props.save(patch).catch(() => undo?.());
</script>

<template>
  <div v-for="range in COMPASS_RANGE_INDICATORS" :key="range.id" class="row" :data-setting="range.enabledSetting">
    <span class="row-label"><span>{{ featureSettingText(range.enabledSetting).label }}</span><small :id="`option-${range.enabledSetting}-help`">{{ featureSettingText(range.enabledSetting).help }}</small></span>
    <span class="row-controls">
      <RangeControl :data-setting="range.opacitySetting" :label="featureSettingText(range.opacitySetting).label" :value="settings[range.opacitySetting]" :min="0" :max="100" unit="%" @change="(value, undo) => change({ [range.opacitySetting]: value }, undo)" />
      <FeatureSwitch :checked="settings[range.enabledSetting]" :label="featureSettingText(range.enabledSetting).label" :describedby="`option-${range.enabledSetting}-help`" @change="change({ [range.enabledSetting]: $event })" />
    </span>
  </div>
</template>
