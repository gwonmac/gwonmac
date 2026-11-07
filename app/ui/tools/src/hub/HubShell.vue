<script setup lang="ts">
/**
 * The Hub window and its closed-Hub receipt, region by region in the order the Hub CSS and its
 * keyboard rely on. It draws the model and puts the keyboard where the model's focus target
 * names (hub-focus.ts); a view's body is one focus zone. Listeners, measuring and the views
 * pages mount into `.hub-view` belong to the controller (app/renderer/hub.ts).
 */
import { ref } from 'vue';
import type { HubViewModel } from '../../../../shared/ui/hub-view';
import { useFocusZone } from './focus-zone';
import { useHubFocus } from './hub-focus';
import HubActionsMenu from './HubActionsMenu.vue';
import HubFooter from './HubFooter.vue';
import HubHeading from './HubHeading.vue';
import HubRateControls from './HubRateControls.vue';
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
defineExpose({ root, receipt, focus });
</script>

<template>
  <dialog id="hub" ref="root" class="ui-modal ui-modal-layer" :data-page="model.page" aria-labelledby="hub-name hub-title-separator hub-caption">
    <section class="hub-panel ui-frame" :data-busy="model.busy ? String(model.busy.panel) : undefined">
      <HubHeading :back="model.back" :caption="model.caption" :crumbs="model.crumbs" :context="model.context" />
      <section class="hub-summary" aria-label="Build to apply" :hidden="!model.summary">
        <HubSummary v-if="model.summary" :summary="model.summary" />
      </section>
      <HubSearchBar :search="model.search" :scope="model.scope" :glyphs="model.glyphs" />
      <HubRateControls v-if="model.rates.host === null" :rates="model.rates" />
      <HubResultList :results="model.results" :rates="model.rates" :busy="model.busy?.list" />
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
      <HubActionsMenu :menu="model.menu" />
      <button class="ui-window-resize hub-resize" aria-label="Resize Hub" title="Drag to resize, or use arrow keys" hidden></button>
    </section>
  </dialog>
  <div
    ref="receipt" class="hub-receipt ui-toast" popover="manual" aria-hidden="true" :hidden="model.receipt.hidden"
    :data-outcome="model.receipt.outcome" :data-tone="model.receipt.tone" :style="model.receipt.place" v-text="model.receipt.text"
  ></div>
  <p class="hub-receipt-announcement ui-sr-only" role="status" aria-atomic="true" v-text="model.receipt.announcement"></p>
</template>
