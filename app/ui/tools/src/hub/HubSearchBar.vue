<script setup lang="ts">
/**
 * The Hub search: the scope chip, the one input the player edits, and the calculation layer that
 * repeats the typed text to place currency art in its word gaps. The input's value belongs to
 * the controller and is never bound here.
 */
import { computed } from 'vue';
import type { HubGlyphs, HubViewModel } from '../../../../shared/ui/hub-view';
import { HUB_SEARCH_GLYPH } from '../../../../shared/ui/hub-search';
import HubImage from './HubImage.vue';

const props = defineProps<{ search: HubViewModel['search']; scope: HubViewModel['scope']; glyphs: HubGlyphs }>();
const box = computed(() => props.glyphs.box ? {
  left: `${props.glyphs.box.left}px`, top: `${props.glyphs.box.top}px`, width: `${props.glyphs.box.width}px`, height: `${props.glyphs.box.height}px`,
} : undefined);
</script>

<template>
  <div class="hub-search ui-hub-search" :hidden="search.hidden">
    <svg viewBox="0 0 24 24" aria-hidden="true" v-html="HUB_SEARCH_GLYPH"></svg>
    <span class="hub-scope" :hidden="scope.hidden" v-text="scope.text"></span>
    <input
      type="text" role="combobox" :aria-label="search.label" aria-describedby="hub-hint" aria-autocomplete="list" aria-controls="hub-results"
      :aria-expanded="search.expanded" :placeholder="search.placeholder" autocomplete="off" spellcheck="false" maxlength="120"
      :aria-activedescendant="search.activeDescendant" :aria-description="search.description" :class="{ 'hub-calculation-input': search.calculation }"
    >
    <span class="hub-progress" aria-hidden="true"></span>
    <div class="hub-search-glyphs" :class="{ 'hub-calculation-input': glyphs.calculation }" aria-hidden="true" :hidden="glyphs.hidden" :style="box">
      <template v-for="(segment, index) in glyphs.segments" :key="index"><span
        v-if="segment.token" :data-start="segment.token.start" :data-end="segment.token.end" :data-unit="segment.token.unit"
      >{{ segment.text }}</span><template v-else>{{ segment.text }}</template></template>
      <HubImage v-for="(icon, index) in glyphs.icons" :key="index" :src="icon.url" :data-unit="icon.unit" :style="{ left: `${icon.left}px` }" />
    </div>
  </div>
</template>
