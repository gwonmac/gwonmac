<script setup lang="ts">
/** The calculator's Price basis picker and its Details or Refresh quotes button. */
import type { Directive } from 'vue';
import type { HubRateControls } from '../../../../shared/ui/hub-view';

defineProps<{ rates: HubRateControls }>();
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
  <div class="hub-rate-controls" :hidden="rates.hidden">
    <template v-if="rates.basis">
      <label>Price basis<select
        class="ui-select" aria-label="Price basis" :data-choices="JSON.stringify(rates.basis.options)" v-select-value="rates.basis.value"
        @change="rates.change(($event.target as HTMLSelectElement).value)" @keydown="rates.keydown"
      >
        <option v-for="(choice, index) in rates.basis.options" :key="index" :value="choice.value">{{ choice.label }}</option>
      </select></label>
      <button class="ui-button" @click="rates.details()">{{ rates.detailsLabel }}</button>
    </template>
  </div>
</template>
