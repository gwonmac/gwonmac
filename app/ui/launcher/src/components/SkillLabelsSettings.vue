<script setup lang="ts">
/**
 * Custom labels for the eight skill slots, recorded from a key or mouse button. They change only
 * the labels gwonmac draws, never Guild Wars key bindings. The host's save status reports each save.
 */
import type { InGamePatch } from "../settings-host";
import { nextTick, ref } from "vue";
import { isSkillKeyInput, skillKeyPresentation, withSkillKeyBinding, type SkillKeyBindings, type SkillKeyInput } from "@shared/skill-key-bindings";

const props = defineProps<{ bindings: SkillKeyBindings; save: (patch: InGamePatch) => Promise<void> }>();
const slot = ref<number | null>(null);
const target = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;
async function start(index: number) {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  slot.value = index;
  await nextTick();
  target.value?.focus();
}
async function stop() {
  slot.value = null;
  await nextTick();
  returnFocus?.focus();
}
async function clear(index: number) {
  await props.save({ skillKeyBindings: withSkillKeyBinding(props.bindings, index, null) }).catch(() => undefined);
}
async function capture(input: SkillKeyInput, event: KeyboardEvent | MouseEvent | WheelEvent) {
  event.preventDefault();
  if (slot.value === null || !isSkillKeyInput(input)) return;
  const index = slot.value;
  void stop();
  await props.save({ skillKeyBindings: withSkillKeyBinding(props.bindings, index, {
    input, modifiers: { control: event.ctrlKey, option: event.altKey, shift: event.shiftKey, command: event.metaKey },
  }) }).catch(() => undefined);
}
</script>

<template>
  <div class="skill-label-settings">
    <p>These labels do not change Guild Wars key bindings. Unset slots use 1–8. Set custom labels to match your game controls.</p>
    <div v-for="(binding, index) in bindings" :key="index" class="skill-label-row">
      <span>Skill {{ index + 1 }} · {{ binding ? skillKeyPresentation(binding).accessibleLabel : `${index + 1} (default)` }}</span>
      <button class="secondary small" :aria-label="`Set skill ${index + 1} label`" @click="start(index)">Set label</button>
      <button class="text-link" :disabled="!binding" :aria-label="`Reset skill ${index + 1} label`" @click="clear(index)">Use default</button>
    </div>
    <template v-if="slot !== null">
      <div ref="target" tabindex="0" class="capture-target" aria-label="Skill label capture"
        @keydown="($event.key === 'Escape' || $event.key === 'Tab') ? ($event.preventDefault(), stop()) : capture({ kind: 'keyboard', code: $event.code }, $event)"
        @mousedown="capture({ kind: 'mouse-button', button: $event.button }, $event)"
        @wheel.prevent="capture({ kind: 'wheel', direction: $event.deltaY < 0 ? 'up' : 'down' }, $event)"
        @contextmenu.prevent>
        Skill {{ slot + 1 }}: press a key, click here, or scroll here. Modifiers are supported. Escape cancels.
      </div>
      <button class="secondary small" @click="stop">Cancel label capture</button>
    </template>
  </div>
</template>

<style scoped>
.skill-label-settings { padding: 4px 18px 20px; }
.skill-label-row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-block: 12px; }
.skill-label-row span { flex: 1; min-width: 160px; }
.capture-target { padding: 20px; margin-block: 16px; border: 1px solid currentColor; border-radius: 8px; }
</style>
