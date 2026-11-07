<script setup lang="ts">
/**
 * The calculator's Conversion rates: the rate source, then one field per rate, and a status
 * line that says what saving did. ⌘↵ saves from any field. The rate source takes the keyboard
 * when the page opens; a rate that cannot be read takes it when saving refuses it.
 */
import { onMounted, ref } from 'vue';
import type { HubRatesProps } from '../../../../../../shared/ui/hub-pages';
import { useFocusZone } from '../../focus-zone';
import { usePageFocus } from '../page';

const props = defineProps<HubRatesProps>();
const form = ref<HTMLFormElement>();
const source = ref<HTMLSelectElement>();
useFocusZone(form);
usePageFocus(form, () => props.focus);
// The fields own their text from here on, as value properties and never attributes; edits,
// a restored draft included, arrive as input and change events.
onMounted(() => {
  if (source.value) source.value.value = props.mode;
  const inputs = form.value?.querySelectorAll('input') ?? [];
  props.fields.forEach((field, index) => { const input = inputs[index]; if (input) input.value = field.value; });
  source.value?.focus();
});
const changeMode = () => props.changeMode(source.value?.value === 'manual' ? 'manual' : 'trader');
function input(key: string, event: Event) { if (event.target instanceof HTMLInputElement) props.input(key, event.target.value); }
function keydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || !event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  event.preventDefault(); event.stopPropagation();
  if (!event.repeat) props.submit();
}
</script>

<template>
  <form ref="form" class="hub-detail" @keydown="keydown" @submit.prevent="submit()">
    <h2>Choose your rates</h2>
    <p>Your rates are saved in gwonmac. They are estimates, not live market quotes. Leave unknown rates blank.</p>
    <select ref="source" class="ui-select" aria-label="Rate source" data-focus-key="rates-source" @change="changeMode">
      <option value="trader">Automatic observed prices</option>
      <option value="manual">Your rates</option>
    </select>
    <label v-for="field in fields" :key="field.key">{{ field.label }}<input class="ui-input" inputmode="decimal" :aria-label="field.label" :data-focus-key="`rates-${field.key}`" @input="input(field.key, $event)"></label>
    <p role="status">{{ status }}</p>
  </form>
</template>
