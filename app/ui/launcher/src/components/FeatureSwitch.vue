<script setup lang="ts">
/**
 * One switch in the Features tab: a native checkbox drawn as a switch, inside a 44-pixel hit
 * area. A locked switch stays in the Tab order and says why through `describedby`, but a click
 * or Space changes nothing. The box always shows the saved value: a change is only a request,
 * and the next snapshot draws the result.
 */
const props = defineProps<{ checked: boolean; label: string; locked?: boolean; describedby?: string | undefined }>();
const emit = defineEmits<{ change: [checked: boolean] }>();

function onClick(event: MouseEvent) {
  if (props.locked) event.preventDefault();
}
function onChange(event: Event) {
  const box = event.target as HTMLInputElement;
  const next = box.checked;
  box.checked = props.checked;
  emit("change", next);
}
</script>

<template>
  <label class="switch-hit">
    <input
      type="checkbox"
      role="switch"
      class="feature-switch"
      :class="{ locked }"
      :checked="checked"
      :aria-label="label"
      :aria-disabled="locked ? 'true' : undefined"
      :aria-describedby="describedby"
      @click="onClick"
      @change="onChange"
    />
  </label>
</template>

<style scoped>
.switch-hit { position: relative; z-index: 1; flex: none; display: grid; place-items: center; width: 44px; height: 36px; margin-right: -6px; cursor: pointer; }
.feature-switch { appearance: none; position: relative; width: 34px; height: 20px; margin: 0; border-radius: var(--radius-pill); background: var(--switch-track); cursor: pointer; transition: background-color .15s ease; }
.feature-switch::before { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: var(--radius-pill); background: var(--text); box-shadow: var(--switch-knob-shadow); transition: transform .15s ease; }
.feature-switch:checked { background: var(--gold); }
.feature-switch:checked::before { transform: translateX(14px); }
.feature-switch:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.feature-switch.locked { opacity: .4; cursor: default; }
.switch-hit:has(.locked) { cursor: default; }
@media (prefers-reduced-motion: reduce) {
  .feature-switch, .feature-switch::before { transition: none; }
}
</style>
