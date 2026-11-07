<script setup lang="ts">
/**
 * A confirmation on its own page: the question and what follows from it. The page itself takes
 * the keyboard, so Enter reaches the footer's named primary once it has armed; Keep is the way out.
 */
import { ref } from 'vue';
import type { HubConfirmProps } from '../../../../../../shared/ui/hub-pages';
import { useFocusZone } from '../../focus-zone';

defineProps<HubConfirmProps>();
const page = ref<HTMLElement>();
useFocusZone(page);
</script>

<template>
  <section ref="page" class="hub-detail hub-confirm" tabindex="0" :aria-label="question" data-focus-key="confirm">
    <h2>{{ question }}</h2>
    <p>{{ consequence }}</p>
  </section>
</template>
