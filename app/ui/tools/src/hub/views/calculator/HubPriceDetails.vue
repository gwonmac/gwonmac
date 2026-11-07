<script setup lang="ts">
/** Price details: the evidence behind a market estimate, and the way to the player's own rates, which takes the keyboard. */
import { onMounted, ref } from 'vue';
import type { HubPriceDetailsProps } from '../../../../../../shared/ui/hub-pages';
import { useFocusZone } from '../../focus-zone';

defineProps<HubPriceDetailsProps>();
const page = ref<HTMLElement>();
const rates = ref<HTMLButtonElement>();
useFocusZone(page);
onMounted(() => rates.value?.focus());
</script>

<template>
  <section ref="page" class="hub-detail">
    <dl>
      <template v-for="([label, value], index) in entries" :key="index">
        <dt>{{ label }}</dt>
        <dd>{{ value }}</dd>
      </template>
    </dl>
    <button ref="rates" class="ui-button" data-focus-key="price-edit-rates" @click="editRates()">Edit rates</button>
  </section>
</template>
