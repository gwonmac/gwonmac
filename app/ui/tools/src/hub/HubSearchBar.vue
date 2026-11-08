<script setup lang="ts">
/**
 * The Hub search: the scope chip, the one input the player edits, and the calculation layer that
 * repeats the typed text to place currency art in its word gaps. The input's value belongs to
 * the controller and is never bound here. The layer measures itself: it stands over the input,
 * puts each unit's art after the unit's last glyph, follows the input's scroll, and holds still
 * while an input method composes, so the overlay never rewrites text or owns editing.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { HubGlyphs, HubViewModel } from '../../../../shared/ui/hub-view';
import { recogniseCurrencyTokens } from '../../../../shared/hub-currency-tokens';
import { HUB_SEARCH_GLYPH } from '../../../../shared/ui/hub-search';
import HubImage from './HubImage.vue';

const props = defineProps<{ search: HubViewModel['search']; scope: HubViewModel['scope']; glyphs: HubGlyphs }>();
const bar = ref<HTMLElement>();
const input = ref<HTMLInputElement>();
const layer = ref<HTMLElement>();

// A composing input method edits text the layer must not follow; it catches up when composition ends.
const composing = ref(false);
const held = ref({ calculation: props.glyphs.calculation, text: props.glyphs.text });
watch(() => [props.glyphs.calculation, props.glyphs.text] as const, ([calculation, text]) => { if (!composing.value) held.value = { calculation, text }; });
const calculation = computed(() => held.value.calculation);
const tokens = computed(() => calculation.value ? recogniseCurrencyTokens(held.value.text) : []);
const segments = computed(() => {
  if (!calculation.value) return [];
  const text = held.value.text, list: { text: string; token?: { start: number; end: number; unit: string } }[] = [];
  let position = 0;
  for (const token of tokens.value) {
    list.push({ text: text.slice(position, token.start) }, { text: text.slice(token.start, token.end), token: { start: token.start, end: token.end, unit: token.unit } });
    position = token.end;
  }
  list.push({ text: text.slice(position) });
  return list;
});

// The layer's box over the input, kept after a calculation ends, and the art's place after each unit.
const box = ref<Readonly<{ left: number; top: number; width: number; height: number }> | null>(null);
const icons = ref<readonly Readonly<{ url: string; unit: string; left: number }>[]>([]);
const followScroll = () => { if (layer.value && input.value) layer.value.scrollLeft = input.value.scrollLeft; };
let scrollFrame = 0;
function measure() {
  const field = input.value, overlay = layer.value, parent = bar.value;
  if (!field || !overlay || !parent || !calculation.value) { icons.value = []; return; }
  const fieldBox = field.getBoundingClientRect(), parentBox = parent.getBoundingClientRect();
  const nextBox = { left: fieldBox.left - parentBox.left, top: fieldBox.top - parentBox.top, width: field.clientWidth, height: field.clientHeight };
  if (JSON.stringify(nextBox) !== JSON.stringify(box.value)) box.value = nextBox;
  const overlayBox = overlay.getBoundingClientRect(), fontSize = Number.parseFloat(getComputedStyle(field).fontSize);
  const spans = [...overlay.querySelectorAll<HTMLElement>('span[data-unit]')];
  const next = tokens.value.flatMap((token, index) => {
    const url = props.glyphs.art(token.unit), span = spans[index]; if (!url || !span) return [];
    const end = span.getBoundingClientRect().right - overlayBox.left + overlay.scrollLeft;
    return [{ url, unit: token.unit, left: end + fontSize * 0.625 }];
  });
  if (JSON.stringify(next) !== JSON.stringify(icons.value)) icons.value = next;
  followScroll();
  cancelAnimationFrame(scrollFrame); scrollFrame = requestAnimationFrame(followScroll);
}
watch(segments, measure, { flush: 'post' });
const resize = new ResizeObserver(() => measure());
onMounted(() => { if (input.value) resize.observe(input.value); });
onBeforeUnmount(() => { resize.disconnect(); cancelAnimationFrame(scrollFrame); });
function compositionEnd() {
  composing.value = false;
  held.value = { calculation: props.glyphs.calculation, text: props.glyphs.text };
}

const style = computed(() => box.value ? {
  left: `${box.value.left}px`, top: `${box.value.top}px`, width: `${box.value.width}px`, height: `${box.value.height}px`,
} : undefined);
</script>

<template>
  <div ref="bar" class="hub-search ui-hub-search" :hidden="search.hidden">
    <svg viewBox="0 0 24 24" aria-hidden="true" v-html="HUB_SEARCH_GLYPH"></svg>
    <span class="hub-scope" :hidden="scope.hidden" v-text="scope.text"></span>
    <input
      ref="input" type="text" role="combobox" :aria-label="search.label" aria-describedby="hub-hint" aria-autocomplete="list" aria-controls="hub-results"
      :aria-expanded="search.expanded" :placeholder="search.placeholder" autocomplete="off" spellcheck="false" maxlength="120"
      :aria-activedescendant="search.activeDescendant" :aria-description="search.description" :class="{ 'hub-calculation-input': calculation }"
      @scroll="followScroll" @select="followScroll" @keyup="followScroll" @compositionstart="composing = true" @compositionend="compositionEnd"
    >
    <span class="hub-progress" aria-hidden="true"></span>
    <div ref="layer" class="hub-search-glyphs" :class="{ 'hub-calculation-input': calculation }" aria-hidden="true" :hidden="!calculation" :style="style">
      <template v-for="(segment, index) in segments" :key="index"><span
        v-if="segment.token" :data-start="segment.token.start" :data-end="segment.token.end" :data-unit="segment.token.unit"
      >{{ segment.text }}</span><template v-else>{{ segment.text }}</template></template>
      <HubImage v-for="(icon, index) in icons" :key="index" :src="icon.url" :data-unit="icon.unit" :style="{ left: `${icon.left}px` }" />
    </div>
  </div>
</template>
