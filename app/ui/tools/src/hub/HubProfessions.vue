<script setup lang="ts">
/** A build's profession pair as icons; the CSS draws the secondary as a badge. */
import type { HubRow } from '../../../../shared/hub';

defineProps<{ professions: NonNullable<HubRow['professions']> }>();
</script>

<template>
  <span class="hub-professions">
    <img v-for="(profession, index) in professions" :key="index" :src="profession.icon" :alt="profession.name" :title="profession.name">
  </span>
</template>
