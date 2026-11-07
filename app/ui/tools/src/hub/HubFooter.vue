<script setup lang="ts">
/**
 * The footer: the keys that act now, the result count, the named primary (↵) and Actions (⌘J).
 * Its slots never hide, so nothing slides under a resting pointer; they disable instead.
 */
import { inject, ref } from 'vue';
import type { HubViewModel } from '../../../../shared/ui/hub-view';
import { FOCUS_ZONE_HOST, useFocusZone } from './focus-zone';
import HubImage from './HubImage.vue';

defineProps<{ legend?: HubViewModel['legend']; count: string; primary?: HubViewModel['primary']; actions: HubViewModel['actions'] }>();
const footer = ref<HTMLElement>();
const host = inject(FOCUS_ZONE_HOST, null);
// ← → between the enabled slots; ↑ to the search, else the view's first control. A slot that
// disables under the keyboard hands it there too.
useFocusZone(footer, {
  orientation: 'horizontal',
  controls: () => [...footer.value?.querySelectorAll<HTMLButtonElement>('.hub-primary, .hub-actions') ?? []].filter(button => !button.hidden && !button.disabled),
  exits: { ArrowUp: () => host?.fallback() ?? null },
});
</script>

<template>
  <footer ref="footer" class="hub-footer">
    <span class="hub-legend" :data-keys="legend && JSON.stringify(legend)">
      <span v-for="([keys, label], index) in legend ?? []" :key="index"><kbd v-for="(cap, at) in keys" :key="at" class="ui-kbd">{{ cap }}</kbd>{{ ` ${label}` }}</span>
    </span>
    <span class="hub-count" v-text="count"></span>
    <button class="hub-primary ui-button" data-focus-key="primary" :data-variant="primary?.variant ?? 'primary'" :title="primary?.label" :disabled="primary?.disabled">
      <template v-if="primary">
        <HubImage v-if="primary.art" :key="primary.art" :src="primary.art" class="hub-primary-art" />
        <span class="hub-primary-label">{{ primary.label }}</span>
        <kbd v-if="primary.keycap" class="ui-kbd">↵</kbd>
      </template>
    </button>
    <button
      class="hub-actions ui-button" data-variant="quiet" data-focus-key="actions" aria-haspopup="menu" :aria-expanded="actions.expanded"
      :aria-keyshortcuts="actions.keys ? 'Meta+J' : undefined" :disabled="actions.disabled"
    >Actions<template v-if="actions.keys"><kbd class="ui-kbd" aria-hidden="true">⌘</kbd><kbd class="ui-kbd" aria-hidden="true">J</kbd></template></button>
  </footer>
</template>
