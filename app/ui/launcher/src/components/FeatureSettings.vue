<script lang="ts">
/**
 * A Feature's Settings, its page's Settings tab: one row per option its manifest declares, drawn by type
 * (switch, number, choice, position), the few values with a control of their own (a map style,
 * Compass rings, colours, skill labels), and its shortcuts. One block for both hosts: the
 * launcher's Features tab and the Hub's Features section pass their own settings, save and
 * shortcut bridge, and an option shows only where that host may change it. The host's save
 * status reports each save; after a refused one, every control shows the saved value again.
 */
import { computed, type Component } from "vue";
import { COMPASS_RANGE_INDICATORS } from "@shared/compass-ranges";
import { optionFor } from "@shared/setting-copy";
import { SHORTCUT_LABELS } from "@shared/keyboard-shortcuts";
import type { LauncherSnapshot } from "@shared/launcher-contracts";
import type { ReleaseStage } from "@shared/release";
import type { InGamePatch, InGameSettings, InGameTools } from "../settings-host";
import type { PerformSave } from "../save-status";
import { featureOptions, type CardFeature, type FeatureOption } from "../features";
import FeatureSwitch from "./FeatureSwitch.vue";
import RangeControl from "./RangeControl.vue";
import ShortcutSetting from "./ShortcutSetting.vue";
import SkillLabelsSettings from "./SkillLabelsSettings.vue";
import AlcoholPositionControl from "./feature-controls/AlcoholPositionControl.vue";
import CompassRangesControl from "./feature-controls/CompassRangesControl.vue";
import CooldownColorControl from "./feature-controls/CooldownColorControl.vue";
import MapStyleControl from "./feature-controls/MapStyleControl.vue";

type Save = (patch: InGamePatch) => Promise<void>;
type Control = Readonly<{
  component: Component;
  /** The props it takes; absent: the settings and the save. */
  props?: (settings: InGameSettings, save: Save) => Record<string, unknown>;
  /** Other options it draws, which get no row of their own. */
  claims?: readonly string[];
  /** The page draws the option's label and help above it. */
  labelled?: true;
}>;
/** The values with a control of their own, by the option the control stands in for. */
const CONTROLS: Readonly<Partial<Record<string, Control>>> = {
  cartographyPresetLibrary: { component: MapStyleControl },
  compassRangeEarshotEnabled: {
    component: CompassRangesControl,
    claims: COMPASS_RANGE_INDICATORS.flatMap((range) => [range.enabledSetting, range.opacitySetting]),
  },
  skillCooldownColor: { component: CooldownColorControl },
  alcoholTimerPosition: { component: AlcoholPositionControl },
  skillKeyBindings: { component: SkillLabelsSettings, props: (settings, save) => ({ bindings: settings.skillKeyBindings, save }), labelled: true },
};
const claimed = new Set(Object.values(CONTROLS).flatMap((control) => control?.claims ?? []));

/** The options this host may change; a value without a control has none here (Travel favourites live in Travel). */
function settingOptions(feature: CardFeature, stage: ReleaseStage, settings: InGameSettings): FeatureOption[] {
  return featureOptions(feature, stage).filter((option) => option.key in settings
    && (CONTROLS[option.key] !== undefined || (!claimed.has(option.key) && option.kind !== "value")));
}
/** Whether this host draws any setting for the Feature: its page shows a Settings tab only then. */
export function hasFeatureSettings(feature: CardFeature, stage: ReleaseStage, settings: InGameSettings): boolean {
  return settingOptions(feature, stage, settings).length > 0 || ("shortcuts" in feature && feature.shortcuts.length > 0);
}
</script>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  feature: CardFeature;
  /** The stage this build shows: an option with a later manifest `stage` gets no row (app/shared/release.ts). */
  stage: ReleaseStage;
  settings: InGameSettings;
  shortcuts: LauncherSnapshot["shortcuts"];
  api?: InGameTools | undefined;
  save: (patch: InGamePatch) => Promise<void>;
  performSave: PerformSave;
}>(), { api: undefined });

const values = computed<Readonly<Record<string, unknown>>>(() => props.settings);
const options = computed(() => settingOptions(props.feature, props.stage, props.settings));
const shortcutRows = computed(() => "shortcuts" in props.feature ? props.feature.shortcuts : []);
const dimmed = (option: FeatureOption) => option.dependsOn !== undefined && values.value[option.dependsOn] === false;
const atFallback = (option: FeatureOption & { kind: "position" }) => JSON.stringify(values.value[option.key]) === JSON.stringify(option.fallback);

/** Saves one option; a refused save (the host's status reports it) puts the control back with `undo`. */
const set = (option: FeatureOption, value: unknown, undo?: () => void) => props.save({ [option.key]: value }).catch(() => undo?.());
function choose(option: FeatureOption & { kind: "choice" }, event: Event) {
  const select = event.target as HTMLSelectElement;
  const value = optionFor(option.choices.map((choice) => choice.value), select.value);
  if (value !== undefined) void set(option, value, () => { select.value = String(values.value[option.key]); });
}
</script>

<template>
  <section v-if="options.length || shortcutRows.length" class="feature-settings">
    <p v-if="'settingsHelp' in feature" class="settings-help">{{ feature.settingsHelp }}</p>
    <template v-for="option in options" :key="option.key">
      <template v-if="CONTROLS[option.key]">
        <div v-if="CONTROLS[option.key]!.labelled" class="control-block" :data-setting="option.key">
          <span class="row-label"><span>{{ option.label }}</span><small>{{ option.help }}</small></span>
          <component :is="CONTROLS[option.key]!.component" v-bind="CONTROLS[option.key]!.props?.(settings, save) ?? { settings, save }" />
        </div>
        <component :is="CONTROLS[option.key]!.component" v-else v-bind="CONTROLS[option.key]!.props?.(settings, save) ?? { settings, save }" />
      </template>
      <div v-else class="row" :class="{ dimmed: dimmed(option) }" :data-setting="option.key">
        <span class="row-label"><span :id="`option-${option.key}`">{{ option.label }}<span v-if="option.stageLabel" class="chip accent stage-label">{{ option.stageLabel }}</span></span><small :id="`option-${option.key}-help`">{{ option.help }}</small></span>
        <FeatureSwitch v-if="option.kind === 'switch'" :checked="values[option.key] === true" :label="option.label" :locked="dimmed(option)" :describedby="`option-${option.key}-help`" @change="set(option, $event)" />
        <RangeControl v-else-if="option.kind === 'range'" :label="option.label" :value="Number(values[option.key])" :min="option.min" :max="option.max" :unit="option.unit" @change="(value, undo) => set(option, value, undo)" />
        <select v-else-if="option.kind === 'choice'" :aria-labelledby="`option-${option.key}`" :aria-describedby="`option-${option.key}-help`" :value="String(values[option.key])" :disabled="dimmed(option)" @change="choose(option, $event)">
          <option v-for="choice in option.choices" :key="choice.value" :value="String(choice.value)">{{ choice.label }}</option>
        </select>
        <button v-else-if="option.kind === 'position'" class="secondary small" :aria-describedby="`option-${option.key}`" :disabled="atFallback(option)" @click="set(option, option.fallback)">Put back</button>
      </div>
    </template>
    <div v-for="shortcut in shortcutRows" :key="shortcut.action" class="row" :data-setting="`shortcut:${shortcut.action}`">
      <span class="row-label"><span>{{ SHORTCUT_LABELS[shortcut.action] }} shortcut</span></span>
      <ShortcutSetting :action="shortcut.action" :shortcuts="shortcuts" :api="api" :perform-save="performSave" />
    </div>
  </section>
</template>

<!-- Not scoped: the controls in ./feature-controls draw the same rows. -->
<style>
.feature-settings { display: flex; flex-direction: column; }
.feature-settings .settings-help { margin: 4px 0 0; color: var(--muted); font-size: var(--fs-sm); }
.feature-settings .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.feature-settings .row.dimmed .row-label { opacity: .55; }
.feature-settings .row-label { display: grid; gap: 3px; font-size: var(--fs-md); }
.feature-settings .row-label small { color: var(--muted); font-size: var(--fs-sm); line-height: 1.45; }
.feature-settings .stage-label { margin-left: 8px; padding: 2px 8px; vertical-align: 1px; }
.feature-settings .row-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px 12px; }
.feature-settings .control-block { display: grid; gap: 8px; padding: 14px 0 0; border-bottom: 1px solid var(--line); }
</style>
