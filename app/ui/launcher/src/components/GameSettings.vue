<script setup lang="ts">
import type { InGamePatch, InGameSnapshot } from "../settings-host";
import { CONTROLLER_SYMBOL_OPTIONS, GAME_SETTINGS, RENDER_SCALE_OPTIONS, settingDetail } from "@shared/setting-copy";
import { CONTROLLER_PROMPT_STYLES, RENDER_SCALES } from "@shared/settings/core";
import { HUB_SHORTCUT, shortcutKeycaps } from "@shared/keyboard-shortcuts";
import { SETTINGS } from "@shared/settings-catalogue";
import { saveChoice } from "../select-choice";

defineProps<{ snapshot: InGameSnapshot; save: (patch: InGamePatch) => Promise<void> }>();
const checked = (event: Event) => (event.currentTarget as HTMLInputElement).checked;
/** The Hub is Core: always on, with keys of its own that do not change. */
const HUB = SETTINGS.find((entry) => entry.id === "hub")!;
</script>

<template>
  <h1>Game</h1>
  <p class="section-intro">Applies to every account. Graphics, audio and key bindings inside Guild Wars are changed in the game.</p>
  <div class="setting-group hub-setting">
    <div class="feature-heading" data-setting="hub">
      <span><strong>{{ HUB.label }}</strong><small>{{ HUB.detail }}</small></span>
      <span class="shortcut-keycaps" aria-label="Command R"><kbd v-for="cap in shortcutKeycaps(HUB_SHORTCUT)" :key="cap.name" :title="cap.name">{{ cap.label }}</kbd></span>
      <span class="built-in">Built in</span>
    </div>
  </div>
  <div class="setting-group">
    <label data-setting="renderScale"><span><strong>{{ GAME_SETTINGS.renderScale.label }}</strong><small>{{ settingDetail(GAME_SETTINGS.renderScale) }}</small></span><select :value="snapshot.settings.renderScale" @change="saveChoice($event, RENDER_SCALES, (renderScale) => save({ renderScale }))"><option v-for="option in RENDER_SCALE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
    <label data-setting="autoRelogAfterReload"><span><strong>{{ GAME_SETTINGS.autoRelogAfterReload.label }}</strong><small>{{ settingDetail(GAME_SETTINGS.autoRelogAfterReload) }}</small></span><input type="checkbox" :checked="snapshot.settings.autoRelogAfterReload" @change="save({ autoRelogAfterReload: checked($event) })" /></label>
    <label data-setting="controllerPromptStyle"><span><strong>{{ GAME_SETTINGS.controllerPromptStyle.label }}</strong><small>{{ settingDetail(GAME_SETTINGS.controllerPromptStyle) }}</small></span><select :value="snapshot.settings.controllerPromptStyle" @change="saveChoice($event, CONTROLLER_PROMPT_STYLES, (controllerPromptStyle) => save({ controllerPromptStyle }))"><option v-for="option in CONTROLLER_SYMBOL_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
    <label data-setting="disableSteamLogin"><span><strong>{{ GAME_SETTINGS.disableSteamLogin.label }}</strong><small>{{ settingDetail(GAME_SETTINGS.disableSteamLogin) }}</small></span><input type="checkbox" :checked="snapshot.settings.disableSteamLogin" @change="save({ disableSteamLogin: checked($event) })" /></label>
    <label data-setting="pasteCleanup"><span><strong>{{ GAME_SETTINGS.pasteCleanup.label }}</strong><small>{{ settingDetail(GAME_SETTINGS.pasteCleanup) }}</small></span><input type="checkbox" :checked="snapshot.settings.pasteCleanup" @change="save({ pasteCleanup: checked($event) })" /></label>
    <label data-setting="hubCalculators"><span><strong>{{ GAME_SETTINGS.hubCalculators.label }}</strong><small>{{ settingDetail(GAME_SETTINGS.hubCalculators) }}</small></span><input type="checkbox" :checked="snapshot.settings.hubCalculators" @change="save({ hubCalculators: checked($event) })" /></label>
    <label data-setting="showDiagnostics"><span><strong>{{ GAME_SETTINGS.showDiagnostics.label }}</strong><small>{{ settingDetail(GAME_SETTINGS.showDiagnostics) }}</small></span><input type="checkbox" :checked="snapshot.settings.showDiagnostics" @change="save({ showDiagnostics: checked($event) })" /></label>
  </div>
</template>
