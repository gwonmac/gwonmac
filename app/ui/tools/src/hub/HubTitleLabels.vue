<script setup lang="ts">
/** What follows a build's name in its title: the profession codes and the template folder. */
import type { HubRow } from '../../../../shared/hub';
import HubIcon from './HubIcon.vue';

defineProps<{ professions?: HubRow['professions']; folder?: HubRow['folder'] }>();
</script>

<template>
  <template v-if="professions?.length">{{ ' ' }}<span class="hub-profession-label">{{ professions.map(profession => profession.code).join('/') }}</span></template>
  <template v-if="folder !== null && folder !== undefined">{{ ' ' }}<span
    class="hub-folder-label" :title="`Template folder: ${folder || 'Skills'}`" :aria-label="`Template folder: ${folder || 'Skills'}`"
  ><HubIcon :row="{ id: 'folder', group: 'Builds' }" />{{ folder || 'Skills' }}</span></template>
</template>
