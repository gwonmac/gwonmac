<script setup lang="ts">
/**
 * The calculator's Price basis picker and its Details or Refresh quotes button. The picker moves
 * between rows with its card and keeps the keyboard; a card that vanishes under it hands the
 * keyboard back to search (HUB-223).
 */
import { ref, type Directive } from 'vue';
import type { HubRateControls } from '../../../../shared/ui/hub-view';
import { useFocusZone } from './focus-zone';

defineProps<{ rates: HubRateControls }>();
const element = ref<HTMLElement>();
useFocusZone(element);
/**
 * Sets the picker's value as a property after its options exist. A `:value` binding would also
 * write a `value` attribute, which the hand-built Hub never had.
 */
const vSelectValue: Directive<HTMLSelectElement, string> = {
  mounted: (select, { value }) => { select.value = value; },
  updated: (select, { value }) => { if (select.value !== value) select.value = value; },
};
</script>

<template>
  <div ref="element" class="hub-rate-controls" :hidden="rates.hidden">
    <template v-if="rates.basis">
      <label>Price basis<select
        class="ui-select" aria-label="Price basis" data-focus-key="rate-basis" :data-choices="JSON.stringify(rates.basis.options)" v-select-value="rates.basis.value"
        @change="rates.change(($event.target as HTMLSelectElement).value)" @keydown="rates.keydown"
      >
        <option v-for="(choice, index) in rates.basis.options" :key="index" :value="choice.value">{{ choice.label }}</option>
      </select></label>
      <button class="ui-button" data-focus-key="rate-details" @click="rates.details()">{{ rates.detailsLabel }}</button>
    </template>
  </div>
</template>
