<script setup lang="ts">
/**
 * Characters on its own Hub page: the search, the card carousel, the display settings, the
 * "Leave this area?" step and an unexpected stop's Technical details. The page owns the keys:
 * the search leads the Tab order and the cards are one roving Tab stop (HUB-137, HUB-138), the
 * shared list keys move along the cards and never wrap, a digit chooses a card (D-5), and typing
 * on a card returns to the search. It measures how many cards fit (HUB-076). Every choice goes to
 * the controller (../renderer/character-switch-palette.ts) as an intent.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { HUB_SEARCH_GLYPH } from '../../../shared/ui/hub-search';
import { isHubBackKey } from '../../../shared/keyboard-shortcuts';
import { normaliseHubQuery } from '../../../shared/hub';
import { listIndexAfter, listKeyStep } from '../../../shared/ui/list-keys';
import { installSearchEditing, resumeSearchInput } from '../../../renderer/search-input';
import { useFocusZone } from '../../../ui/tools/src/hub/focus-zone';
import { usePageFocus } from '../../../ui/tools/src/hub/views/page';
import { CHARACTER_SEARCH_LIMIT, numberedCharacterPosition, type HubCharacterCard, type HubCharactersProps } from './characters-page';

const props = defineProps<HubCharactersProps>();
const root = ref<HTMLElement>();
const panel = ref<HTMLElement>();
const list = ref<HTMLUListElement>();
const queryInput = ref<HTMLInputElement>();
const choices = ref<HTMLElement>();
const details = ref<HTMLDetailsElement>();
// The carousel reveals the selected card itself, so focus never scrolls it.
usePageFocus(root, () => props.focus, { preventScroll: true });
useFocusZone(list, { fallback: () => queryInput.value ?? null });
useFocusZone(choices, { orientation: 'horizontal' });

const confirming = computed(() => props.view === 'confirming');
const settings = computed(() => props.view === 'settings');
const browsing = computed(() => settings.value || confirming.value);
const typed = computed(() => normaliseHubQuery(props.query) !== '');
const active = computed(() => props.cards.find(card => card?.row === props.selected) ?? null);
const isCard = (card: HubCharacterCard | null): card is HubCharacterCard => card !== null;
const cardButton = (row: number) => list.value?.querySelector<HTMLButtonElement>(`button[data-row="${row}"]`) ?? null;
const rowOf = (event: Event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-row]') : null;
  return button ? { button, row: Number(button.dataset.row) } : null;
};
const isDigit = (key: string) => /^[0-9]$/u.test(key);
/** Esc closes an open disclosure first and puts the keyboard on its summary. */
const closeDisclosure = (target: EventTarget | null) => {
  const open = target instanceof Element ? target.closest<HTMLDetailsElement>('details[open]') : null;
  if (!open || !panel.value?.contains(open)) return false;
  open.open = false;
  open.querySelector('summary')?.focus({ preventScroll: true });
  return true;
};

// A new unexpected stop starts with its Technical details closed.
watch(() => props.unexpected, shown => { if (shown && details.value) details.value.open = false; });
watch(() => props.reveal, () => { cardButton(props.selected)?.scrollIntoView({ block: 'nearest' }); }, { flush: 'post' });

function panelKeydown(event: KeyboardEvent) {
  // Escape during composition cancels the composition, never the query (HUB-140).
  if (event.isComposing || event.defaultPrevented) return;
  // From the cards ⌘⌫ is the Hub's own Back; one level per physical press.
  if (isHubBackKey(event) && browsing.value) {
    event.preventDefault();
    if (!event.repeat) props.back();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    // One step per physical press; an open disclosure is the innermost level.
    if (event.repeat || closeDisclosure(event.target)) return;
    props.escape();
  } else if (props.view !== 'characters') return;
  else if (event.key === 'ArrowDown' && event.target === queryInput.value) {
    event.preventDefault();
    cardButton(props.selected)?.focus({ preventScroll: true });
    cardButton(props.selected)?.scrollIntoView({ block: 'nearest' });
  }
  // The search is the top of the view: ↑ there stays, like at the top of every list.
  else if (event.key === 'ArrowUp' && event.target === queryInput.value) event.preventDefault();
  else {
    // A digit selects and reveals its card; only Enter switches (D-5, HUB-002).
    if (typed.value || event.target instanceof HTMLInputElement || !isDigit(event.key) || event.metaKey || event.ctrlKey || event.altKey) return;
    event.preventDefault();
    const position = numberedCharacterPosition(event.key, Math.min(props.listed, 10));
    if (position === null || event.repeat) return;
    props.choose(position);
  }
}
function searchKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || props.switching || event.isComposing || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
  event.preventDefault();
  props.submit();
}
function listKeydown(event: KeyboardEvent) {
  const card = rowOf(event);
  if (!card || props.view !== 'characters') return;
  if (event.key === 'ArrowUp') {
    event.preventDefault(); event.stopPropagation(); queryInput.value?.focus({ preventScroll: true }); return;
  }
  // The shared list move: arrows, ⌃N/⌃P, PgUp/PgDn by a visible page, Home/End; the carousel never wraps.
  const step = listKeyStep(event, Math.max(1, props.cards.filter(isCard).length - 1), true);
  if (step !== null) {
    event.preventDefault();
    event.stopPropagation();
    props.choose(listIndexAfter(card.row, props.listed, step));
    return;
  }
  // Without a query a digit is a card number, never search text.
  if (!typed.value && isDigit(event.key)) return;
  if (queryInput.value) resumeSearchInput(event, queryInput.value);
}
function listFocusin(event: FocusEvent) {
  const card = rowOf(event);
  if (card) props.focused(card.row);
}
// A click selects a card; Enter, the footer primary or a double-click that started on the same
// card switches (D-24). A keyboard activation (detail 0) switches as before.
function listClick(event: MouseEvent) {
  const card = rowOf(event);
  if (card && !card.button.disabled) props.press(card.row, event.detail);
}
// Right-click selects a card like a click and switches nothing, even as part of a later
// double-click (HUB-248). A card has no Actions of its own.
function listContextmenu(event: MouseEvent) {
  const card = rowOf(event);
  if (!card) return;
  event.preventDefault();
  if (card.button.disabled) return;
  props.context(card.row);
  card.button.focus({ preventScroll: true });
}
const leaveClicked = (event: MouseEvent) => { if (event.detail <= 1) props.depart(); };
const toggled = () => { if (details.value?.open) props.detailsOpened(); };
const displayChanged = (field: 'profession' | 'level' | 'location', event: Event) => {
  if (event.target instanceof HTMLInputElement) props.setDisplay(field, event.target.checked);
};

/** The narrowest readable card in the Hub, and the gap between cards (hub.css). */
const CARD_MIN_WIDTH = 100;
const CARD_GAP = 8;
/** As many cards as fit at 100 px or more in the carousel's own width: one, three or five (HUB-076). */
const radius = () => {
  const width = list.value?.clientWidth ?? 0;
  if (!width) return 2;
  const fit = Math.floor((width + CARD_GAP) / (CARD_MIN_WIDTH + CARD_GAP));
  return fit >= 5 ? 2 : fit >= 3 ? 1 : 0;
};
const resized = () => props.measured(radius(), true);
// The fields hold their state as properties, never attributes, like the player's own edits.
const settingsPanel = ref<HTMLElement>();
const fill = () => {
  if (queryInput.value && queryInput.value.value !== props.query) queryInput.value.value = props.query;
  for (const field of ['profession', 'level', 'location'] as const) {
    const box = settingsPanel.value?.querySelector<HTMLInputElement>(`#character-switch-show-${field}`);
    if (box) box.checked = props.display[field];
  }
};
watch(() => [props.query, props.display] as const, fill, { flush: 'post' });
let observer: ResizeObserver | null = null;
let stopEditing = () => {};
onMounted(() => {
  fill();
  if (list.value && queryInput.value) stopEditing = installSearchEditing(list.value, queryInput.value);
  // The Hub can be resized without a window resize; the card count follows the carousel's width.
  observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => props.measured(radius(), false)) : null;
  if (list.value) observer?.observe(list.value);
  window.addEventListener('resize', resized);
  props.measured(radius(), false);
});
onBeforeUnmount(() => { stopEditing(); observer?.disconnect(); window.removeEventListener('resize', resized); });
</script>

<template>
  <div
    id="character-switch-root" ref="root" class="ui-modal ui-modal-layer" aria-labelledby="character-switch-title" open=""
    :aria-describedby="confirming ? 'character-switch-confirm-copy' : undefined" data-layout="horizontal" :data-switching="String(switching)"
  >
    <div ref="panel" class="ui-frame character-switch-panel" data-layout="horizontal" @keydown="panelKeydown">
      <label class="character-switch-search ui-hub-search" for="character-switch-query" :hidden="browsing || switching">
        <span class="ui-sr-only">Search characters</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" v-html="HUB_SEARCH_GLYPH"></svg>
        <input
          id="character-switch-query" ref="queryInput" data-focus-key="character-switch-query" class="ui-input" type="search" role="combobox"
          :aria-controls="searching ? 'character-switch-list' : undefined" aria-autocomplete="list" autocomplete="off" spellcheck="false"
          :maxlength="CHARACTER_SEARCH_LIMIT" placeholder="Search characters…" :aria-expanded="String(searching && listed > 0)"
          :aria-activedescendant="active && listbox ? `character-switch-option-${active.index}` : undefined" 
          @input="search(($event.target as HTMLInputElement).value)" @keydown="searchKeydown"
        >
      </label>
      <header class="character-switch-head">
        <h2 id="character-switch-title" :class="{ 'ui-sr-only': !confirming }">{{ heading }}</h2>
        <span class="character-switch-count" aria-live="polite" aria-atomic="true" :hidden="confirming">{{ count }}</span>
        <button
          class="ui-button character-switch-head-action character-switch-settings-toggle" type="button" aria-label="Character Switch settings"
          data-focus-key="Character Switch settings" :aria-pressed="String(settings)" :hidden="confirming" :disabled="switching" @click="toggleSettings()"
        ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button
          class="ui-button character-switch-head-action character-switch-close" type="button" aria-label="Close Switch Character"
          data-focus-key="Close Switch Character" @click="close()"
        ><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13"/></svg></button>
      </header>
      <div class="character-switch-carousel" :hidden="browsing">
        <button
          class="ui-button character-switch-arrow character-switch-previous" type="button" aria-label="Previous character" data-focus-key="Previous character"
          :hidden="browsing" :disabled="switching || selected <= 0" @click="step(-1)"
        ><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10.5 2.5-5 5 5 5"/></svg></button>
        <ul
          id="character-switch-list" ref="list" class="character-switch-list ui-scroll" aria-label="Characters" :hidden="browsing"
          :role="listbox ? 'listbox' : undefined" :aria-orientation="listbox ? 'horizontal' : undefined"
          :style="capacity === null ? undefined : { '--character-cards': String(capacity) }"
          @keydown="listKeydown" @focusin="listFocusin" @click="listClick" @contextmenu="listContextmenu"
        >
          <template v-for="(card, slot) in cards" :key="card ? card.key : `slot-${slot}`">
            <li v-if="card === null" role="presentation" class="character-switch-slot" aria-hidden="true"></li>
            <li v-else role="presentation">
              <!-- The focus key names the character, not its place: when the focused card leaves the
                   list, the card that moves into its place never takes the keyboard; the search does. -->
              <button
                type="button" :id="`character-switch-option-${card.index}`" :data-focus-key="`character-switch-card:${card.key}`" class="character-switch-row"
                role="option" :aria-setsize="String(listed)" :aria-posinset="String(card.row + 1)" :data-index="String(card.index)" :data-row="String(card.row)"
                :data-character-key="card.key" :data-selected="String(card.row === selected)" :aria-selected="String(card.row === selected)" :disabled="switching"
                :aria-disabled="refused ? 'true' : undefined" :aria-current="card.current ? 'true' : undefined" :title="card.current ? 'Already active' : undefined"
                :aria-label="card.label" :tabindex="card.row === selected ? 0 : -1"
              >
                <span class="character-switch-key">{{ card.shortcut === null ? '' : String(card.shortcut) }}</span>
                <img v-if="card.icon" :src="card.icon" alt="" aria-hidden="true">
                <span class="character-switch-copyline">
                  <span class="character-switch-primary">
                    <span class="character-switch-name">{{ card.name }}</span>
                    <span v-if="card.current" class="character-switch-current">Current</span>
                  </span>
                  <span v-if="card.meta !== null" class="character-switch-meta" :title="card.meta">{{ card.meta }}</span>
                </span>
              </button>
            </li>
          </template>
        </ul>
        <button
          class="ui-button character-switch-arrow character-switch-next" type="button" aria-label="Next character" data-focus-key="Next character"
          :hidden="browsing" :disabled="switching || selected >= listed - 1" @click="step(1)"
        ><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 2.5 5 5-5 5"/></svg></button>
      </div>
      <section ref="settingsPanel" class="character-switch-settings" aria-label="Character Switch settings" :hidden="!settings">
        <label class="character-switch-setting" for="character-switch-show-profession">
          <span><strong>Show profession</strong><small>Icon, primary, and secondary profession</small></span>
          <input
            id="character-switch-show-profession" data-focus-key="character-switch-show-profession" type="checkbox"
            :disabled="savingDisplay" @change="displayChanged('profession', $event)"
          >
        </label>
        <label class="character-switch-setting" for="character-switch-show-level">
          <span><strong>Show level</strong><small>Character level</small></span>
          <input
            id="character-switch-show-level" data-focus-key="character-switch-show-level" type="checkbox"
            :disabled="savingDisplay" @change="displayChanged('level', $event)"
          >
        </label>
        <label class="character-switch-setting" for="character-switch-show-location">
          <span><strong>Show known location</strong><small>Locations from the reviewed Travel catalogue</small></span>
          <input
            id="character-switch-show-location" data-focus-key="character-switch-show-location" type="checkbox"
            :disabled="savingDisplay" @change="displayChanged('location', $event)"
          >
        </label>
      </section>
      <section class="character-switch-confirm" aria-describedby="character-switch-confirm-copy" :hidden="!confirming">
        <p id="character-switch-confirm-copy">{{ confirm.detail }}</p>
        <div ref="choices" class="character-switch-confirm-actions">
          <button type="button" id="character-switch-stay" data-focus-key="character-switch-stay" class="ui-button character-switch-stay" @click="stay()">Stay here</button>
          <button
            type="button" id="character-switch-leave" data-focus-key="character-switch-leave" class="ui-button character-switch-leave" data-variant="danger"
            :data-armed="confirm.armed ? '' : undefined" @click="leaveClicked"
          >{{ confirm.leave }}</button>
        </div>
      </section>
      <p class="character-switch-status" role="status" aria-live="polite" aria-atomic="true" :data-level="status.warning ? 'warning' : undefined">{{ status.text }}</p>
      <details ref="details" class="character-switch-details" :hidden="!unexpected" @toggle="toggled">
        <summary>Technical details</summary>
        <pre>{{ diagnostics }}</pre>
        <button type="button" class="ui-button character-switch-copy" @click="copyDiagnostics()">Copy diagnostics</button>
      </details>
    </div>
  </div>
</template>
