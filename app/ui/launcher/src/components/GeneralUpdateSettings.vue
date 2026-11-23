<script setup lang="ts">
/** The Updates section of Settings: the automatic check, and the app update's state and action. */
import { computed } from "vue";
import type { AppUpdateState } from "@shared/contracts";
import type { LauncherSettings, LauncherSettingsPatch } from "@shared/launcher-contracts";
import { applicationUpdatePresentation } from "../update-game-files-copy";
import FeatureSwitch from "./FeatureSwitch.vue";

const props = defineProps<{
  settings: Pick<LauncherSettings, "autoCheckUpdates">;
  update: AppUpdateState;
  save: (patch: LauncherSettingsPatch) => Promise<void>;
  check: () => Promise<void>;
  restart: () => Promise<void>;
  openReleases: () => Promise<void>;
}>();

const presentation = computed(() => applicationUpdatePresentation(props.update));

function performAction(): Promise<void> {
  if (presentation.value.action === "restart") return props.restart();
  if (presentation.value.action === "releases") return props.openReleases();
  return props.check();
}
</script>

<template>
  <h1>Updates</h1>
  <div class="setting-group">
    <div class="setting-row" data-setting="autoCheckUpdates">
      <span>
        <strong>Automatically check for launcher updates</strong>
        <small id="setting-autoCheckUpdates-help">Checks for Guild Wars Reforged app updates. Guild Wars game files update separately.</small>
      </span>
      <FeatureSwitch :checked="settings.autoCheckUpdates" label="Automatically check for launcher updates" describedby="setting-autoCheckUpdates-help" @change="save({ autoCheckUpdates: $event })" />
    </div>
    <div class="setting-row">
      <span><strong>{{ presentation.title }}</strong><small>{{ presentation.detail }}</small></span>
      <button
        v-if="presentation.action !== 'none'"
        class="small" :class="presentation.action === 'restart' ? 'primary' : 'secondary'"
        @click="performAction"
      >{{ presentation.actionLabel }}</button>
    </div>
  </div>
</template>
