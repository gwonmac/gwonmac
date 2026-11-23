<script setup lang="ts">
/**
 * Maps' style on its Feature page: the active built-in or custom style, its terrain border, a
 * preview, the editor for a custom style, and sharing, importing and deleting styles. The whole
 * library is one setting (`cartographyPresetLibrary`); app/shared/cartography-presets.ts owns
 * every change to it. The page's save status reports each save; after a refused one, every
 * control shows the saved value again (docs/settings.md rule 3).
 */
import { computed, nextTick, ref } from "vue";
import { featureSettingText } from "@shared/feature-contracts";
import {
  CARTOGRAPHY_BUILTIN_PRESETS,
  CARTOGRAPHY_LINE_PATTERNS,
  CARTOGRAPHY_UNSEEN_MARKERS,
  decodeCartographyPreset,
  encodeCartographyPreset,
  isCartographyBuiltinPresetId,
  type CartographyColor,
  type CartographyLineStyle,
  type CartographyPresetStyle,
} from "@shared/cartography-overlay";
import {
  addCartographyPreset,
  deleteCartographyPreset,
  renameCartographyPreset,
  replaceCartographyPresetStyle,
  resolveCartographyPresetEntry,
  selectCartographyPreset,
} from "@shared/cartography-presets";
import type { InGamePatch, InGameSettings } from "../../settings-host";
import { saveChoice } from "../../select-choice";
import BaseModal from "../BaseModal.vue";
import ColorControl from "../ColorControl.vue";
import MapStylePreview from "../MapStylePreview.vue";
import RangeControl from "../RangeControl.vue";

const props = defineProps<{ settings: InGameSettings; save: (patch: InGamePatch) => Promise<void> }>();
const TEXT = featureSettingText("cartographyPresetLibrary");

const status = ref("");
const importValue = ref("");
const editing = ref(false);
const confirmDelete = ref(false);
const styleEditor = ref<HTMLElement | null>(null);
const customizeButton = ref<HTMLButtonElement | null>(null);
const library = computed(() => props.settings.cartographyPresetLibrary);
const active = computed(() => resolveCartographyPresetEntry(library.value));
const exportValue = computed(() => active.value ? encodeCartographyPreset({ name: active.value.name, style: active.value.style }) : "");
const lineLabels = { hover: "Hovered cell", normalRange: "3×3 range", birdsEyeRange: "7×7 range" } as const;

async function revealEditor() {
  await nextTick();
  styleEditor.value?.scrollIntoView({ block: "start", container: "nearest" });
  styleEditor.value?.focus({ preventScroll: true });
}
async function closeEditor() {
  editing.value = false;
  await nextTick();
  customizeButton.value?.scrollIntoView({ block: "nearest", container: "nearest" });
  customizeButton.value?.focus({ preventScroll: true });
}

/**
 * The page's save status reports a failure, and `undo` shows the saved value in the control the
 * player changed; `status` says only what the style editor itself refused.
 */
async function persist(patch: InGamePatch, undo?: () => void) {
  status.value = "";
  try { await props.save(patch); return true; } catch { undo?.(); return false; }
}
/** Puts a select or a text field back to the saved value; take it while its change event runs. */
function restore(event: Event, saved: () => string | undefined): () => void {
  const control = event.currentTarget;
  return () => {
    const value = saved();
    if (value !== undefined && (control instanceof HTMLSelectElement || control instanceof HTMLInputElement)) control.value = value;
  };
}

async function selectPreset(value: string, undo?: () => void) {
  const [kind, id] = value.split(":");
  if (kind !== "builtin" && kind !== "custom") return;
  if (kind === "builtin" && !isCartographyBuiltinPresetId(id)) return;
  const next = selectCartographyPreset(library.value, kind === "builtin" && isCartographyBuiltinPresetId(id) ? { kind, id } : { kind: "custom", id: id ?? "" });
  if (next) await persist({ cartographyPresetLibrary: next }, undo);
}

async function customize() {
  const source = active.value;
  if (!source) return;
  if (source.custom) { editing.value = true; await revealEditor(); return; }
  const next = addCartographyPreset(library.value, { id: `preset-${crypto.randomUUID()}`, name: `${source.name} custom`, style: source.style });
  if (!next) { status.value = "The custom style limit has been reached. Delete an unused style first."; return; }
  if (await persist({ cartographyPresetLibrary: next })) { editing.value = true; await revealEditor(); }
}

async function rename(value: string, undo: () => void) {
  const current = active.value?.custom;
  if (!current) return;
  const next = renameCartographyPreset(library.value, current.id, value);
  if (next) await persist({ cartographyPresetLibrary: next }, undo);
  else status.value = "Enter a style name from 1 to 40 characters.";
}

async function remove() {
  const current = active.value?.custom;
  if (!current) return;
  const next = deleteCartographyPreset(library.value, current.id);
  if (!next) return;
  editing.value = false;
  await persist({ cartographyPresetLibrary: next });
}

async function importPreset() {
  const imported = decodeCartographyPreset(importValue.value);
  if (!imported) { status.value = "That style text is not valid."; return; }
  const next = addCartographyPreset(library.value, { id: `preset-${crypto.randomUUID()}`, ...imported });
  if (!next) { status.value = "The style could not be added."; return; }
  if (await persist({ cartographyPresetLibrary: next })) importValue.value = "";
}

async function saveStyle(style: CartographyPresetStyle, undo: () => void) {
  const source = active.value;
  if (!source) return;
  const next = source.custom
    ? replaceCartographyPresetStyle(library.value, source.custom.id, style)
    : addCartographyPreset(library.value, { id: `preset-${crypto.randomUUID()}`, name: `${source.name} custom`, style });
  if (next) await persist({ cartographyPresetLibrary: next }, undo);
  else {
    undo();
    status.value = "The style could not be changed. Delete an unused custom style and try again.";
  }
}
async function updateLine(key: keyof typeof lineLabels, patch: Partial<CartographyLineStyle>, undo: () => void) {
  const source = active.value?.style;
  if (source) await saveStyle({ ...source, grid: { ...source.grid, [key]: { ...source.grid[key], ...patch } } }, undo);
}
async function updateWalkability(patch: Partial<CartographyPresetStyle["walkability"]>, undo: () => void) {
  const source = active.value?.style;
  if (source) await saveStyle({ ...source, walkability: { ...source.walkability, ...patch } }, undo);
}
async function updateGrid(value: CartographyColor, undo: () => void) {
  const source = active.value?.style;
  if (source) await saveStyle({ ...source, grid: { ...source.grid, casingColor: value } }, undo);
}
async function updateUnseen(patch: Partial<CartographyPresetStyle["grid"]["unseen"]>, undo: () => void) {
  const source = active.value?.style;
  if (source) await saveStyle({ ...source, grid: { ...source.grid, unseen: { ...source.grid.unseen, ...patch } } }, undo);
}
</script>

<template>
  <div class="row" data-setting="cartographyPresetLibrary">
    <span class="row-label"><span id="option-cartographyPresetLibrary">{{ TEXT.label }}</span><small id="option-cartographyPresetLibrary-help">{{ TEXT.help }}</small></span>
    <span class="row-controls">
      <select aria-labelledby="option-cartographyPresetLibrary" aria-describedby="option-cartographyPresetLibrary-help" :value="`${library.activePreset.kind}:${library.activePreset.id}`" @change="selectPreset(($event.currentTarget as HTMLSelectElement).value, restore($event, () => `${library.activePreset.kind}:${library.activePreset.id}`))">
        <optgroup label="Built in"><option v-for="(preset, id) in CARTOGRAPHY_BUILTIN_PRESETS" :key="id" :value="`builtin:${id}`">{{ preset.name }}</option></optgroup>
        <optgroup v-if="library.customPresets.length" label="My styles"><option v-for="preset in library.customPresets" :key="preset.id" :value="`custom:${preset.id}`">{{ preset.name }}</option></optgroup>
      </select>
      <button ref="customizeButton" class="secondary small" @click="customize">{{ active?.custom ? "Edit style" : "Customize style" }}</button>
    </span>
  </div>
  <div v-if="active" class="row" data-setting="cartographyBoundaryWidth">
    <span class="row-label"><span>Terrain border thickness</span><small>0 hides the border. Changing a built-in style saves a custom copy.</small></span>
    <RangeControl label="Terrain border thickness" :value="active.style.walkability.boundaryWidth" :min="0" :max="4" unit="px" @change="(value, undo) => updateWalkability({ boundaryWidth: value }, undo)" />
  </div>
  <MapStylePreview v-if="active" class="map-style-preview" :style="active.style" :grid-opacity="settings.cartographyGridOpacity" :terrain-opacity="settings.cartographyWalkabilityOpacity" />

  <div v-if="editing && active?.custom" ref="styleEditor" class="map-style-editor" tabindex="-1" data-focus-target role="region" :aria-label="`Edit ${active.name}`">
    <div class="row"><span class="row-label"><span>Edit {{ active.name }}</span><small>Changes save automatically.</small></span><button class="secondary small" @click="closeEditor">Done</button></div>
    <h3>Walkable terrain</h3>
    <div class="row"><span class="row-label"><span>Shaded area color</span></span><ColorControl label="Shaded area color" :value="active.style.walkability.veilColor" @change="(value, undo) => updateWalkability({ veilColor: value }, undo)" /></div>
    <div class="row"><span class="row-label"><span>Terrain border color</span></span><ColorControl label="Terrain border color" :value="active.style.walkability.boundaryColor" @change="(value, undo) => updateWalkability({ boundaryColor: value }, undo)" /></div>
    <div class="row"><span class="row-label"><span>Border outline color</span></span><ColorControl label="Border outline color" :value="active.style.walkability.boundaryCasingColor" @change="(value, undo) => updateWalkability({ boundaryCasingColor: value }, undo)" /></div>
    <h3>Grid</h3>
    <div class="row"><span class="row-label"><span>Grid outline color</span></span><ColorControl label="Grid outline color" :value="active.style.grid.casingColor" @change="updateGrid" /></div>
    <div class="row"><span class="row-label"><span>Unseen cell color</span></span><ColorControl label="Unseen cell color" :value="active.style.grid.unseen.color" @change="(value, undo) => updateUnseen({ color: value }, undo)" /></div>
    <label class="row"><span class="row-label"><span>Unseen cell marker</span></span><select :value="active.style.grid.unseen.marker" @change="saveChoice($event, CARTOGRAPHY_UNSEEN_MARKERS, (marker) => updateUnseen({ marker }, restore($event, () => active?.style.grid.unseen.marker)))"><option v-for="marker in CARTOGRAPHY_UNSEEN_MARKERS" :key="marker" :value="marker">{{ marker }}</option></select></label>
    <details class="advanced-map-lines"><summary>Inspection outlines</summary>
      <fieldset v-for="(label, key) in lineLabels" :key="key" class="map-line-editor">
        <legend>{{ label }}</legend>
        <div class="row"><span class="row-label"><span>Color</span></span><ColorControl :label="`${label} color`" :value="active.style.grid[key].color" @change="(value, undo) => updateLine(key, { color: value }, undo)" /></div>
        <div class="row"><span class="row-label"><span>Width</span></span><RangeControl :label="`${label} width`" :value="active.style.grid[key].width" :min="0" :max="4" unit="px" @change="(value, undo) => updateLine(key, { width: value }, undo)" /></div>
        <label class="row"><span class="row-label"><span>Pattern</span></span><select :aria-label="`${label} pattern`" :value="active.style.grid[key].pattern" @change="saveChoice($event, CARTOGRAPHY_LINE_PATTERNS, (pattern) => updateLine(key, { pattern }, restore($event, () => active?.style.grid[key].pattern)))"><option v-for="pattern in CARTOGRAPHY_LINE_PATTERNS" :key="pattern" :value="pattern">{{ pattern }}</option></select></label>
      </fieldset>
    </details>
  </div>

  <div class="map-library">
    <template v-if="active?.custom">
      <label class="row"><span class="row-label"><span>Style name</span></span><input :value="active.name" maxlength="40" @change="rename(($event.currentTarget as HTMLInputElement).value, restore($event, () => active?.name))" /></label>
      <button class="text-link" @click="confirmDelete = true">Delete custom style</button>
    </template>
    <details><summary>Import or share a style</summary>
      <label>Current style<textarea rows="4" :value="exportValue" readonly /></label>
      <p>Select the text and press Command-C to share the current style.</p>
      <label>Import style<textarea v-model="importValue" rows="4" placeholder="Paste style text" /></label>
      <button class="secondary small" :disabled="!importValue.trim()" @click="importPreset">Import as new style</button>
    </details>
    <button class="secondary small" @click="selectPreset('builtin:cartographer')">Use Cartographer defaults</button>
  </div>
  <p v-if="status" class="inline-message" role="status" aria-live="polite">{{ status }}</p>

  <BaseModal v-if="confirmDelete && active?.custom" labelledby="delete-style-title" @close="confirmDelete = false">
    <h2 id="delete-style-title">Delete {{ active.name }}?</h2>
    <p>This removes this custom style permanently. Your other styles are kept.</p>
    <div class="form-actions"><button class="secondary" @click="confirmDelete = false">Cancel</button><button class="danger-button" @click="confirmDelete = false; remove()">Delete style</button></div>
  </BaseModal>
</template>

<style scoped>
.map-style-preview { margin: 14px 0 4px; }
.map-style-editor { display: flex; flex-direction: column; margin-top: 8px; padding: 4px 16px 12px; border: 1px solid var(--line); border-radius: var(--radius-md); }
.map-style-editor h3 { margin: 16px 0 0; font-size: var(--fs-md); font-weight: 600; }
.map-line-editor { margin: 8px 0 0; padding: 0; border: 0; }
.map-line-editor legend { padding: 8px 0 0; font-size: var(--fs-sm); font-weight: 600; }
.advanced-map-lines > summary, .map-library summary { padding: 12px 0; cursor: pointer; }
.map-library { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.map-library details { align-self: stretch; }
.map-library details label { display: grid; gap: 6px; margin-bottom: 10px; }
.map-library .row { align-self: stretch; }
.map-library > .text-link { color: var(--danger-text); border-bottom-color: currentColor; }
.map-library textarea { width: 100%; resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.map-library details p { color: var(--muted); font-size: var(--fs-sm); }
</style>
