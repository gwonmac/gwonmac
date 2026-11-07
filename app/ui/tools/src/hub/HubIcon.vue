<script setup lang="ts">
/** A row's icon: its own art, else the Hub icon family's drawing for its kind. */
import { computed } from 'vue';
import type { HubRow } from '../../../../shared/hub';
import { hubIconSvg } from '../../../../shared/ui/hub-icon';

const props = defineProps<{ row: Pick<HubRow, 'icon' | 'iconKind'> }>();
const kind = computed(() => props.row.iconKind ?? 'command');
</script>

<template>
  <span v-if="row.icon" class="hub-icon" aria-hidden="true"><img :src="row.icon" alt=""></span>
  <span v-else class="hub-icon" aria-hidden="true" :data-kind="kind" v-html="hubIconSvg(kind)"></span>
</template>
