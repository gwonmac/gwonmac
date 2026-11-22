<script setup lang="ts">
/**
 * Alcohol Timer's place on its Feature page. Besides Put back, Show to place keeps the timer on
 * screen while the character is sober, until the player selects its lock in the game window.
 */
import { DEFAULT_ALCOHOL_TIMER_POSITION } from "@shared/alcohol-timer";
import { featureSettingText } from "@shared/feature-contracts";
import type { InGamePatch, InGameSettings } from "../../settings-host";

const props = defineProps<{ settings: InGameSettings; save: (patch: InGamePatch) => Promise<void> }>();
const TEXT = featureSettingText("alcoholTimerPosition");
/** The page's save note reports a failure. */
const change = (patch: InGamePatch) => props.save(patch).catch(() => undefined);
</script>

<template>
  <div class="row" data-setting="alcoholTimerPosition">
    <span class="row-label"><span id="option-alcoholTimerPosition">{{ TEXT.label }}</span><small>{{ TEXT.help }}</small></span>
    <span class="row-controls">
      <button class="secondary small" aria-describedby="option-alcoholTimerPosition" @click="change({ alcoholTimerPosition: { ...settings.alcoholTimerPosition, locked: false } })">Show to place</button>
      <button class="secondary small" aria-describedby="option-alcoholTimerPosition" @click="change({ alcoholTimerPosition: DEFAULT_ALCOHOL_TIMER_POSITION })">Put back</button>
    </span>
  </div>
</template>
