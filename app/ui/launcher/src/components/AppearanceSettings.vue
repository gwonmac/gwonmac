<script setup lang="ts">
/**
 * The Appearance section of Settings: panel style, font, text size and opacity for gwonmac panels
 * in game, the custom theme with its colours and shareable text, and the look every map Feature
 * shares (the options their manifests mark `appearance`, drawn with the Feature page's rows).
 * The page's save status reports each save; this section says only when pasted theme text is not valid.
 */
import type { LauncherSnapshot } from "@shared/launcher-contracts";
import type { ReleaseStage } from "@shared/release";
import type { InGamePatch, InGameSettings } from "../settings-host";
import type { PerformSave } from "../save-status";
import { CARD_FEATURES } from "../features";
import FeatureSettings, { appearanceFeatures } from "./FeatureSettings.vue";
import { computed, ref } from "vue";
import { UI_FONTS, UI_PANEL_OPACITY_MIN, UI_PANEL_OPACITY_MAX, UI_STYLES, UI_TEXT_SIZE_MIN, UI_TEXT_SIZE_MAX, type UiFont } from "@shared/settings/core";
import { UI_THEME_COLOR_FIELDS, UI_THEME_MATERIALS, decodeCustomUiTheme, encodeCustomUiTheme, defaultCustomUiTheme, type CustomUiTheme, type UiThemeColorField } from "@shared/ui-theme";
import { customThemeReadable } from "@shared/ui-color";
import ColorControl from "./ColorControl.vue";
import FeatureSwitch from "./FeatureSwitch.vue";
import RangeControl from "./RangeControl.vue";
import PanelStylePreview from "./PanelStylePreview.vue";
import { saveChoice } from "../select-choice";

const props = defineProps<{
  settings: InGameSettings;
  save: (patch: InGamePatch) => Promise<void>;
  stage: ReleaseStage;
  shortcuts: LauncherSnapshot["shortcuts"];
  performSave: PerformSave;
}>();
const mapLook = computed(() => appearanceFeatures(CARD_FEATURES, props.stage, props.settings));
const message = ref("");
const imported = ref("");
const shared = computed(() => encodeCustomUiTheme(props.settings.uiCustomTheme));
const readable = computed(() => customThemeReadable(props.settings.uiCustomTheme));
const fonts: Record<UiFont, string> = { "guild-wars": "Guild Wars", inter: "Inter", system: "System", avenir: "Avenir", georgia: "Georgia", palatino: "Palatino" };
const colors: Record<UiThemeColorField, string> = {
  window: "Window background", titlebar: "Title bar", surface: "Panel surface",
  recessed: "Input background", selected: "Selection", accent: "Accent",
  text: "Text", mutedText: "Secondary text", border: "Border",
};
async function persist(patch: InGamePatch) {
  message.value = "";
  try { await props.save(patch); return true; }
  catch { return false; }
}
function updateTheme(patch: Partial<CustomUiTheme>) {
  return persist({ uiCustomTheme: { ...props.settings.uiCustomTheme, ...patch } });
}
async function importTheme() {
  const theme = decodeCustomUiTheme(imported.value);
  if (!theme) { message.value = "That theme text is not valid."; return; }
  if (await persist({ uiStyle: "custom", uiCustomTheme: theme })) imported.value = "";
}
</script>

<template>
  <h2 class="appearance-heading">In-game panels</h2>
  <p>Style, font, and opacity update GWonMac panels in every open game window. Guild Wars menus keep their own appearance.</p>
  <div class="setting-group">
    <label data-setting="uiStyle"><span><strong>Panel style</strong></span><select :value="settings.uiStyle" @change="saveChoice($event, UI_STYLES, (uiStyle) => persist({ uiStyle }))"><option value="guild-wars">Guild Wars</option><option value="obsidian">Modern</option><option value="custom">Custom</option></select></label>
    <label data-setting="uiFont"><span><strong>Panel font</strong></span><select :value="settings.uiFont" @change="saveChoice($event, UI_FONTS, (uiFont) => persist({ uiFont }))"><option v-for="font in UI_FONTS" :key="font" :value="font">{{ fonts[font] }}</option></select></label>
    <div class="setting-row" data-setting="uiTextSize"><span><strong>Text size</strong></span><RangeControl label="Text size" :value="settings.uiTextSize" :min="UI_TEXT_SIZE_MIN" :max="UI_TEXT_SIZE_MAX" unit="%" @change="persist({ uiTextSize: $event })" /></div>
    <div class="setting-row" data-setting="uiPanelOpacity"><span><strong>Panel opacity</strong></span><RangeControl label="Panel opacity" :value="settings.uiPanelOpacity" :min="UI_PANEL_OPACITY_MIN" :max="UI_PANEL_OPACITY_MAX" unit="%" @change="persist({ uiPanelOpacity: $event })" /></div>
    <PanelStylePreview :settings="settings" />
    <template v-if="settings.uiStyle === 'custom'">
      <label><span><strong>Panel finish</strong></span><select :value="settings.uiCustomTheme.material" @change="saveChoice($event, UI_THEME_MATERIALS, (material) => updateTheme({ material }))"><option value="classic">Classic</option><option value="modern">Modern flat</option></select></label>
      <div class="setting-row"><span><strong>Window gradient</strong></span><FeatureSwitch :checked="settings.uiCustomTheme.windowGradient" label="Window gradient" @change="updateTheme({ windowGradient: $event })" /></div>
      <div class="setting-row"><span><strong>Custom colors</strong><small>Restore this palette without changing other settings.</small></span><button class="secondary small" @click="persist({ uiCustomTheme: defaultCustomUiTheme(settings.uiCustomTheme.material) })">Restore default colors</button></div>
      <div v-for="field in UI_THEME_COLOR_FIELDS" :key="field" class="setting-row"><span>{{ colors[field] }}</span><ColorControl :label="colors[field]" :value="settings.uiCustomTheme[field]" @change="updateTheme({ [field]: $event })" /></div>
      <p v-if="!readable" role="status" class="inline-message">Some text will be hard to read on these colors. Choose a title bar, panel surface and input background closer in lightness to the window background.</p>
      <details class="theme-sharing">
        <summary>Import or share a theme</summary>
        <label>Current theme<textarea :value="shared" readonly rows="3" /></label>
        <p>Select the text and press Command-C to copy it.</p>
        <label>Import theme<textarea v-model="imported" rows="3" placeholder="Paste theme text" /></label>
        <button class="secondary small" :disabled="!imported.trim()" @click="importTheme">Import theme</button>
      </details>
    </template>
  </div>
  <p v-if="message" role="status" class="inline-message">{{ message }}</p>
  <template v-if="mapLook.length">
    <h2 class="appearance-heading">Maps and Compass</h2>
    <p>The map style and the Compass buttons apply to every map Feature: the Exploration grid, the Walking route, Compass ranges and the Elite Skill Planner.</p>
    <FeatureSettings v-for="feature in mapLook" :key="feature.id" place="appearance" :feature="feature" :stage="stage" :settings="settings" :shortcuts="shortcuts" :save="save" :perform-save="performSave" />
  </template>
</template>

<style scoped>
.appearance-heading { margin: 28px 0 8px; font: inherit; font-size: 20px; font-weight: 600; }
.theme-sharing label { display: grid; gap: 8px; margin-block: 16px; }
.theme-sharing textarea { min-width: 0; resize: vertical; }
.theme-sharing button { margin: 0 12px 12px 0; }
</style>
