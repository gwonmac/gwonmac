<script setup lang="ts">
/** The build a section applies, above its search: name, professions, folder, skills and detail. */
import type { HubSummary } from '../../../../shared/hub';
import HubBuildInfo from './HubBuildInfo.vue';
import HubProfessions from './HubProfessions.vue';
import HubTitleLabels from './HubTitleLabels.vue';

defineProps<{ summary: HubSummary }>();
</script>

<template>
  <span class="hub-summary-label">{{ summary.label }}</span>
  <strong><HubProfessions v-if="summary.professions" :professions="summary.professions" />{{ summary.title }}<HubTitleLabels
    :professions="summary.professions" :folder="summary.folder"
  /></strong>
  <HubBuildInfo v-if="summary.skills" :build="summary" />
  <p v-if="summary.detail">{{ summary.detail }}</p>
</template>
