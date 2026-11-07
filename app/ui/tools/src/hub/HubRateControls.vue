<script setup lang="ts">
/**
 * The calculator's Price basis picker and its Details or Refresh quotes button, drawn in the
 * selected row it prices from that row's `quoteBasis`. It keeps the keyboard while its row
 * stays; a card that vanishes under it hands the keyboard back to search (HUB-223). Enter on the
 * picker runs the row's primary through the Hub, as Enter on the search does (HUB-022).
 */
import { ref, type Directive } from 'vue';
import type { HubQuoteBasis } from '../../../../shared/hub';
import { useFocusZone } from './focus-zone';

defineProps<{ basis: HubQuoteBasis; hidden: boolean }>();
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
  <div ref="element" class="hub-rate-controls" :hidden="hidden">
    <label>Price basis<select
      class="ui-select" aria-label="Price basis" data-focus-key="rate-basis" :data-choices="JSON.stringify(basis.options)" v-select-value="basis.value"
      @change="basis.choose(($event.target as HTMLSelectElement).value)"
    >
      <option v-for="(choice, index) in basis.options" :key="index" :value="choice.value">{{ choice.label }}</option>
    </select></label>
    <button class="ui-button" data-focus-key="rate-details" @click="basis.details.run()">{{ basis.details.label }}</button>
  </div>
</template>
