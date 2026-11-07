<script setup lang="ts">
/**
 * The results listbox: the painted rows in groups, each group named by its first row's heading.
 * The controller paints a long list in chunks, so only `painted` rows are in the DOM. The list
 * owns its scrolling: it brings a row the keyboard moved to into view, keeps the reader's place
 * when the rows are rebuilt, and scrolls a restored page back to its offset, asking the
 * controller for more rows until the painted ones reach it, so no row height is ever guessed.
 */
import { computed, ref, watch } from 'vue';
import type { HubRow } from '../../../../shared/hub';
import type { HubViewModel } from '../../../../shared/ui/hub-view';
import HubResultRow from './HubResultRow.vue';

const props = defineProps<{ results: HubViewModel['results']; busy: boolean | undefined }>();
type Section = { key: string; id: string; group: string; rows: { row: HubRow; index: number }[] };
const sections = computed(() => {
  const list: Section[] = [];
  props.results.rows.slice(0, props.results.painted).forEach((row, index) => {
    const last = list.at(-1);
    if (last?.group === row.group) last.rows.push({ row, index });
    // Keyed by group, not position: when a narrower query drops an earlier group, the rows that
    // stay keep their DOM nodes and a pointer action already aimed at them (HUB-170).
    else list.push({ key: `${row.group}#${list.filter(section => section.group === row.group).length}`, id: `hub-group-${index}`, group: row.group, rows: [{ row, index }] });
  });
  return list;
});

const element = ref<HTMLElement>();
// The offset the painted rows must reach: the reader's place before a rebuild, or a restored page's.
let place: { top: number; restore: boolean } | null = null;
watch(() => props.results.rows, () => { const top = element.value?.scrollTop ?? 0; if (!place && top > 0) place = { top, restore: false }; }, { flush: 'pre' });
watch(() => props.results.scroll?.seq, () => { const scroll = props.results.scroll; if (scroll) place = { top: scroll.top, restore: true }; }, { flush: 'pre' });
watch(() => [props.results.rows, props.results.painted, props.results.scroll?.seq], () => {
  const list = element.value, wanted = place;
  if (!list || !wanted) return;
  if (list.scrollHeight < wanted.top + list.clientHeight && props.results.painted < props.results.rows.length) { props.results.more(); return; }
  place = null;
  if (wanted.restore) list.scrollTop = wanted.top;
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
