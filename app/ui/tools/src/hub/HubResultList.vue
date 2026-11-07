<script setup lang="ts">
/**
 * The results listbox: the painted rows in groups, each group named by its first row's heading.
 * The controller paints a long list in chunks, so only `painted` rows are in the DOM.
 */
import { computed } from 'vue';
import type { HubRow } from '../../../../shared/hub';
import type { HubRateControls, HubViewModel } from '../../../../shared/ui/hub-view';
import HubResultRow from './HubResultRow.vue';

const props = defineProps<{ results: HubViewModel['results']; rates: HubRateControls; busy: boolean | undefined }>();
type Section = { id: string; group: string; rows: { row: HubRow; index: number }[] };
const sections = computed(() => {
  const list: Section[] = [];
  props.results.rows.slice(0, props.results.painted).forEach((row, index) => {
    const last = list.at(-1);
    if (last?.group === row.group) last.rows.push({ row, index });
    else list.push({ id: `hub-group-${index}`, group: row.group, rows: [{ row, index }] });
  });
  return list;
});
</script>

<template>
  <div
    id="hub-results" data-focus-key="results" class="hub-results ui-scroll" :class="{ 'hub-preview-list': results.previewList }" role="listbox" aria-label="Results" tabindex="-1"
    :hidden="results.hidden" :aria-busy="busy"
  >
    <div v-for="section in sections" :key="section.id" role="group" :aria-labelledby="section.id">
      <div :id="section.id" class="hub-group" role="presentation">{{ section.group }}</div>
      <HubResultRow
        v-for="entry in section.rows" :key="entry.row.id" :row="entry.row" :index="entry.index"
        :selected="entry.row.id === results.selected" :compact="results.compact" :bindings="results.bindings"
        :rates="rates.host === entry.row.id ? rates : null"
      />
    </div>
  </div>
</template>
