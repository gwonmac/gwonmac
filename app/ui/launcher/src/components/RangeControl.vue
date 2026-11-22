<script setup lang="ts">
/**
 * A whole-number setting as a slider with a number field beside it. A value out of range is
 * refused here with its reason; a valid one is emitted with `undo`, which a host whose save was
 * refused calls to show the saved value again.
 */
import { ref, useId, watch } from "vue";

const props = defineProps<{ label: string; value: number; min: number; max: number; unit?: string }>();
const emit = defineEmits<{ change: [value: number, undo: () => void] }>();
const errorId = useId();
const draft = ref(props.value);
const error = ref("");
watch(() => props.value, value => { draft.value = value; error.value = ""; });
/** Shows the saved value again, after a save the host refused. */
function undo() {
  draft.value = props.value;
  error.value = "";
}
function commit(input: HTMLInputElement) {
  const value = input.valueAsNumber;
  if (!Number.isInteger(value) || value < props.min || value > props.max) {
    error.value = `Enter a whole number from ${props.min} to ${props.max}.`;
    return;
  }
  draft.value = value;
  error.value = "";
  emit("change", value, undo);
}
</script>

<template>
  <div class="range-control">
    <input type="range" :aria-label="label" :min="min" :max="max" step="1" :value="draft"
      :aria-valuetext="`${draft}${unit ?? ''}`"
      @input="draft = ($event.currentTarget as HTMLInputElement).valueAsNumber"
      @change="commit($event.currentTarget as HTMLInputElement)" />
    <div class="range-value">
      <input type="number" :aria-label="`${label} value`" :min="min" :max="max" step="1" :value="draft"
        :aria-invalid="!!error" :aria-describedby="error ? errorId : undefined"
        @change="commit($event.currentTarget as HTMLInputElement)" />
      <span v-if="unit" aria-hidden="true">{{ unit }}</span>
    </div>
    <small v-if="error" :id="errorId" role="alert" class="control-error">{{ error }}</small>
  </div>
</template>

<style scoped>
.range-control { display: grid; grid-template-columns: minmax(80px, 1fr) auto; align-items: center; gap: 12px; width: 264px; max-width: 100%; }
.range-control input[type="range"] { width: 100%; min-width: 0; height: 34px; padding: 0; border: 0; background: transparent; accent-color: var(--gold); }
.range-value { display: flex; align-items: center; gap: 6px; }
.range-value input { width: 60px; height: 34px; padding: 8px; font-variant-numeric: tabular-nums; }
.range-value span { color: var(--muted); }
.control-error { grid-column: 1 / -1; }
</style>
