<script setup lang="ts">
/**
 * Hub preferences: pins and search phrases as one list in two labelled groups, Home's order.
 * The list keeps DOM focus and moves its selection by aria-activedescendant; ⌥⌘↑/↓ move the
 * chosen entry from anywhere on the page. Move up and Move down disable by aria-disabled, so a
 * focused button keeps the keyboard at the end of the list (HUB-090).
 */
import { computed, onMounted, onUpdated, ref } from 'vue';
import type { HubPreferencesProps } from '../../../../../../shared/ui/hub-pages';
import { listIndexAfter, listKeyStep } from '../../../../../../shared/ui/list-keys';
import { useFocusZone } from '../../focus-zone';
import HubIcon from '../../HubIcon.vue';

const props = defineProps<HubPreferencesProps>();
const view = ref<HTMLElement>();
const list = ref<HTMLElement>();
useFocusZone(view);

/** Each entry with its place in the whole list, which names its option and its group's heading. */
const numbered = computed(() => {
  let index = 0;
  return props.groups.map(group => ({ label: group.label, entries: group.entries.map(entry => ({ ...entry, index: index++ })) }));
});
const entries = computed(() => numbered.value.flatMap(group => group.entries));
const chosenOption = computed(() => entries.value.find(entry => entry.id === props.chosen));

function choose(id: string) { props.choose(id); list.value?.focus({ preventScroll: true }); }
function context(id: string) { choose(id); props.actions(); }
function keydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (event.altKey && event.metaKey && !event.ctrlKey && !event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault(); props.move(event.key === 'ArrowUp' ? -1 : 1); return;
  }
  const step = event.target === list.value ? listKeyStep(event, 5) : null;
  if (step === null) return;
  event.preventDefault();
  const target = entries.value[listIndexAfter(entries.value.findIndex(entry => entry.id === props.chosen), entries.value.length, step)];
  if (target) props.choose(target.id);
}
// The chosen entry stays in view.
const reveal = () => { if (chosenOption.value) list.value?.querySelector(`#hub-preference-${chosenOption.value.index}`)?.scrollIntoView({ block: 'nearest' }); };
onMounted(reveal);
onUpdated(reveal);
</script>

<template>
  <section ref="view" class="hub-detail hub-preferences" @keydown="keydown">
    <h2>Pins and search phrases</h2>
    <div
      id="hub-preference-list" ref="list" class="hub-preference-list" tabindex="0" role="listbox" aria-label="Pins and search phrases"
      data-focus-key="preferences-list" :aria-activedescendant="chosenOption ? `hub-preference-${chosenOption.index}` : undefined" :hidden="!entries.length"
    >
      <div v-for="group in numbered" :key="group.entries[0]!.index" class="hub-preference-group" role="group" :aria-labelledby="`hub-preference-group-${group.entries[0]!.index}`">
        <div :id="`hub-preference-group-${group.entries[0]!.index}`" class="hub-group" role="presentation">{{ group.label }}</div>
        <div
          v-for="entry in group.entries" :id="`hub-preference-${entry.index}`" :key="entry.id" class="hub-preference-option" role="option"
          :aria-selected="entry.id === chosen" @click="choose(entry.id)" @contextmenu.prevent="context(entry.id)"
        >
          <HubIcon :row="entry.icon" />
          <span>{{ entry.label }}</span>
        </div>
      </div>
    </div>
    <div class="hub-preference-tools" :hidden="!entries.length">
      <button
        type="button" class="ui-button" title="Move up (⌥⌘↑)" aria-keyshortcuts="Alt+Meta+ArrowUp" aria-controls="hub-preference-list"
        data-focus-key="preferences-move-up" :aria-disabled="!canMoveUp" @click="move(-1)"
      >Move up</button>
      <button
        type="button" class="ui-button" title="Move down (⌥⌘↓)" aria-keyshortcuts="Alt+Meta+ArrowDown" aria-controls="hub-preference-list"
        data-focus-key="preferences-move-down" :aria-disabled="!canMoveDown" @click="move(1)"
      >Move down</button>
    </div>
    <p :hidden="!!entries.length">Choose a result, then Actions to pin it or give it a search phrase.</p>
    <button type="button" class="ui-button" data-focus-key="preferences-remove-phrases" :disabled="!canRemovePhrases" @click="removePhrases">Remove all search phrases…</button>
    <button type="button" class="ui-button" data-focus-key="preferences-reset-position" @click="resetPosition">Reset Hub position</button>
    <p role="status">{{ status }}</p>
  </section>
</template>
