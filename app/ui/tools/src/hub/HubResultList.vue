<script setup lang="ts">
/**
 * The results listbox: the painted rows in groups, each group named by its first row's heading.
 * The controller paints a long list in chunks, so only the `painted` rows are in the DOM, and a
 * row a jump lands on paints before the rows above it. Groups come from the whole list, so a
 * group keeps its node while the rows above fill in. The list owns its scrolling: it brings a
 * row the keyboard moved to into view and puts a restored page's row back where it stood. The
 * browser's scroll anchoring keeps the rows in view in place while rows fill in above them.
 */
import { computed, ref, watch } from 'vue';
import type { HubRow } from '../../../../shared/hub';
import type { HubViewModel } from '../../../../shared/ui/hub-view';
import HubResultRow from './HubResultRow.vue';

const props = defineProps<{ results: HubViewModel['results']; busy: boolean | undefined }>();
type Section = { key: string; id: string; group: string; rows: { row: HubRow; index: number }[] };
const sections = computed(() => {
  const { rows, painted } = props.results;
  const list: Section[] = [], runs = new Map<string, number>();
  let run: Section | undefined, range = 0, shown: Section | undefined;
  rows.forEach((row, index) => {
    // Keyed by group, not position: when a narrower query drops an earlier group, the rows that
    // stay keep their DOM nodes and a pointer action already aimed at them (HUB-170).
    if (run?.group !== row.group) {
      const count = runs.get(row.group) ?? 0;
      runs.set(row.group, count + 1);
      run = { key: `${row.group}#${count}`, id: `hub-group-${index}`, group: row.group, rows: [] };
    }
    while (range < painted.length && painted[range]![1] <= index) range++;
    if (range >= painted.length || painted[range]![0] > index) return;
    if (shown !== run) { list.push(run); shown = run; }
    run.rows.push({ row, index });
  });
  return list;
});

const element = ref<HTMLElement>();
watch(() => props.results.scroll?.seq, () => {
  const list = element.value, place = props.results.scroll?.place;
  if (!list) return;
  const row = place ? list.querySelector<HTMLElement>(`[data-id="${CSS.escape(place.id)}"]`) : null;
  list.scrollTop = row && place ? list.scrollTop + row.getBoundingClientRect().top - list.getBoundingClientRect().top + place.offset : 0;
}, { flush: 'post' });
watch(() => props.results.reveal?.seq, () => {
  const id = props.results.reveal?.id;
  if (id !== undefined) element.value?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' });
}, { flush: 'post' });
</script>

<template>
  <div
    id="hub-results" ref="element" data-focus-key="results" class="hub-results ui-scroll" :class="{ 'hub-preview-list': results.previewList }" role="listbox" aria-label="Results" tabindex="-1"
    :hidden="results.hidden" :aria-busy="busy"
  >
    <div v-for="section in sections" :key="section.key" role="group" :aria-labelledby="section.id">
      <div :id="section.id" class="hub-group" role="presentation">{{ section.group }}</div>
      <HubResultRow
        v-for="entry in section.rows" :key="entry.row.id" :row="entry.row" :index="entry.index"
        :selected="entry.row.id === results.selected" :compact="results.compact" :bindings="results.bindings" :list-hidden="results.hidden" @run="results.run()"
      />
    </div>
  </div>
</template>
