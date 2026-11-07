<script setup lang="ts">
/**
 * The Hub window and its closed-Hub receipt, region by region in the order the Hub CSS and its
 * keyboard rely on. It draws the model and puts the keyboard where the model's focus target
 * names (hub-focus.ts); a view's body is one focus zone. It places the Actions menu on the
 * footer and the receipt in the closed frame's footprint, and shows and hides the receipt's
 * popover. Listeners and the views pages mount into `.hub-view` belong to the controller
 * (app/renderer/hub.ts).
 */
import { computed, ref, watch } from 'vue';
import type { HubViewModel } from '../../../../shared/ui/hub-view';
import { useFocusZone } from './focus-zone';
import { useHubFocus } from './hub-focus';
import HubActionsMenu from './HubActionsMenu.vue';
import HubFooter from './HubFooter.vue';
import HubHeading from './HubHeading.vue';
import HubResultList from './HubResultList.vue';
import HubSearchBar from './HubSearchBar.vue';
import HubSummary from './HubSummary.vue';

const props = defineProps<{ model: HubViewModel }>();
const root = ref<HTMLDialogElement>();
const receipt = ref<HTMLElement>();
const view = ref<HTMLElement>();
const focus = useHubFocus(root, view, () => props.model);
// ↑ ↓ step between a view's controls in screen order; a mounted view moves the keyboard itself.
useFocusZone(view, { orientation: 'screen', rescue: false });
// The menu stands on the footer, however tall the footer is; it keeps its place once closed.
const menuBottom = ref<string>();
watch(() => props.model.menu, menu => {
  const footer = root.value?.querySelector<HTMLElement>('.hub-footer');
  if (!menu.hidden && footer) menuBottom.value = `${footer.offsetHeight + 8}px`;
}, { flush: 'post' });
const receiptPlace = computed(() => {
  const frame = props.model.receipt.frame;
  return frame?.width ? { left: `${frame.left + frame.width / 2}px`, bottom: `${Math.max(8, window.innerHeight - frame.bottom + 12)}px`, maxWidth: `${Math.max(0, frame.width - 24)}px` } : undefined;
});
// A passive top-layer receipt stays above popouts without taking focus or intercepting game input;
// each new receipt raises it again.
watch(() => props.model.receipt, next => {
  if (next.hidden) receipt.value?.hidePopover(); else receipt.value?.showPopover();
}, { flush: 'post' });
defineExpose({ root, focus });
</script>

<template>
  <dialog id="hub" ref="root" class="ui-modal ui-modal-layer" :data-page="model.page" aria-labelledby="hub-name hub-title-separator hub-caption">
    <section class="hub-panel ui-frame" :data-busy="model.busy ? String(model.busy.panel) : undefined">
      <HubHeading :back="model.back" :caption="model.caption" :crumbs="model.crumbs" :context="model.context" />
      <section class="hub-summary" aria-label="Build to apply" :hidden="!model.summary">
        <HubSummary v-if="model.summary" :summary="model.summary" />
      </section>
      <HubSearchBar :search="model.search" :scope="model.scope" :glyphs="model.glyphs" />
      <HubResultList :results="model.results" :busy="model.busy?.list" />
      <p class="hub-empty" :hidden="model.empty.hidden">No matches</p>
      <pre class="hub-preview ui-scroll" :hidden="model.preview.hidden" v-text="model.preview.text"></pre>
      <div ref="view" class="hub-view" :hidden="model.view.hidden" :aria-busy="model.busy?.view"></div>
      <div class="hub-footer-status">
        <p class="hub-status" role="status" :title="model.status?.text" :aria-busy="model.status?.busy" v-text="model.status?.text ?? ''"></p>
        <p class="hub-lifecycle" :hidden="model.lifecycle.hidden" :title="model.lifecycle.title" v-text="model.lifecycle.text"></p>
        <p id="hub-hint" class="hub-hint" :hidden="model.hint.hidden" :title="model.hint.title" v-text="model.hint.text"></p>
      </div>
      <p class="hub-announce ui-sr-only" role="status" aria-live="polite" aria-atomic="true" v-text="model.announce"></p>
      <HubFooter :legend="model.legend" :count="model.count" :primary="model.primary" :actions="model.actions" />
      <HubActionsMenu :menu="model.menu" :bottom="menuBottom" />
      <button class="ui-window-resize hub-resize" aria-label="Resize Hub" data-focus-key="resize" title="Drag to resize, or use arrow keys" hidden></button>
    </section>
  </dialog>
  <div
    ref="receipt" class="hub-receipt ui-toast" popover="manual" aria-hidden="true" :hidden="model.receipt.hidden"
    :data-outcome="model.receipt.outcome" :data-tone="model.receipt.tone" :style="receiptPlace" v-text="model.receipt.text"
  ></div>
  <p class="hub-receipt-announcement ui-sr-only" role="status" aria-atomic="true" v-text="model.receipt.announcement"></p>
</template>
