<script setup lang="ts">
/**
 * The Game section of Settings: the built-in Hub row and the game-wide choices (render scale,
 * picture shape, reload, controller symbols, Steam login, paste clean-up, Hub calculators, diagnostics).
 */
import type { InGamePatch, InGameSnapshot } from "../settings-host";
import { CONTROLLER_SYMBOL_OPTIONS, GAME_SETTINGS, PICTURE_SHAPE_OPTIONS, RENDER_SCALE_OPTIONS, settingDetail } from "@shared/setting-copy";
import { CONTROLLER_PROMPT_STYLES, PICTURE_SHAPES, RENDER_SCALES } from "@shared/settings/core";
import { HUB_SHORTCUT, shortcutKeycaps } from "@shared/keyboard-shortcuts";
import { SETTINGS } from "@shared/settings-catalogue";
import { saveChoice } from "../select-choice";
import FeatureSwitch from "./FeatureSwitch.vue";

defineProps<{ snapshot: InGameSnapshot; save: (patch: InGamePatch) => Promise<void> }>();
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
    <label data-setting="pictureShape"><span><strong>{{ GAME_SETTINGS.pictureShape.label }}</strong><small>{{ settingDetail(GAME_SETTINGS.pictureShape) }}</small></span><select :value="snapshot.settings.pictureShape" @change="saveChoice($event, PICTURE_SHAPES, (pictureShape) => save({ pictureShape }))"><option v-for="option in PICTURE_SHAPE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
    <div class="setting-row" data-setting="autoRelogAfterReload"><span><strong>{{ GAME_SETTINGS.autoRelogAfterReload.label }}</strong><small id="setting-autoRelogAfterReload-help">{{ settingDetail(GAME_SETTINGS.autoRelogAfterReload) }}</small></span><FeatureSwitch :checked="snapshot.settings.autoRelogAfterReload" :label="GAME_SETTINGS.autoRelogAfterReload.label" describedby="setting-autoRelogAfterReload-help" @change="save({ autoRelogAfterReload: $event })" /></div>
    <label data-setting="controllerPromptStyle"><span><strong>{{ GAME_SETTINGS.controllerPromptStyle.label }}</strong><small>{{ settingDetail(GAME_SETTINGS.controllerPromptStyle) }}</small></span><select :value="snapshot.settings.controllerPromptStyle" @change="saveChoice($event, CONTROLLER_PROMPT_STYLES, (controllerPromptStyle) => save({ controllerPromptStyle }))"><option v-for="option in CONTROLLER_SYMBOL_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
    <div class="setting-row" data-setting="disableSteamLogin"><span><strong>{{ GAME_SETTINGS.disableSteamLogin.label }}</strong><small id="setting-disableSteamLogin-help">{{ settingDetail(GAME_SETTINGS.disableSteamLogin) }}</small></span><FeatureSwitch :checked="snapshot.settings.disableSteamLogin" :label="GAME_SETTINGS.disableSteamLogin.label" describedby="setting-disableSteamLogin-help" @change="save({ disableSteamLogin: $event })" /></div>
    <div class="setting-row" data-setting="pasteCleanup"><span><strong>{{ GAME_SETTINGS.pasteCleanup.label }}</strong><small id="setting-pasteCleanup-help">{{ settingDetail(GAME_SETTINGS.pasteCleanup) }}</small></span><FeatureSwitch :checked="snapshot.settings.pasteCleanup" :label="GAME_SETTINGS.pasteCleanup.label" describedby="setting-pasteCleanup-help" @change="save({ pasteCleanup: $event })" /></div>
    <div class="setting-row" data-setting="hubCalculators"><span><strong>{{ GAME_SETTINGS.hubCalculators.label }}</strong><small id="setting-hubCalculators-help">{{ settingDetail(GAME_SETTINGS.hubCalculators) }}</small></span><FeatureSwitch :checked="snapshot.settings.hubCalculators" :label="GAME_SETTINGS.hubCalculators.label" describedby="setting-hubCalculators-help" @change="save({ hubCalculators: $event })" /></div>
    <div class="setting-row" data-setting="showDiagnostics"><span><strong>{{ GAME_SETTINGS.showDiagnostics.label }}</strong><small id="setting-showDiagnostics-help">{{ settingDetail(GAME_SETTINGS.showDiagnostics) }}</small></span><FeatureSwitch :checked="snapshot.settings.showDiagnostics" :label="GAME_SETTINGS.showDiagnostics.label" describedby="setting-showDiagnostics-help" @change="save({ showDiagnostics: $event })" /></div>
  </div>
</template>
