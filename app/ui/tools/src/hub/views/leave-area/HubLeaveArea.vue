<script setup lang="ts">
/**
 * "Leave this area?" on its own page (D-27): the question, its consequence and the two choices.
 * ← and → move between them. The leave button never takes the later click of a multi-click
 * (HUB-027); its controller (app/renderer/leave-area.ts) arms it, refuses a press before then
 * (HUB-242) and owns the outcome.
 */
import { ref } from 'vue';
import type { HubLeaveAreaProps } from '../../../../../../shared/ui/hub-pages';
import { useFocusZone } from '../../focus-zone';
import { usePageFocus } from '../page';

const props = defineProps<HubLeaveAreaProps>();
const page = ref<HTMLElement>();
const choices = ref<HTMLElement>();
useFocusZone(choices, { orientation: 'horizontal' });
usePageFocus(page, () => props.focus);
const leaveClicked = (event: MouseEvent) => { if (event.detail <= 1) props.depart(); };
</script>

<template>
  <section ref="page" class="hub-leave-area" aria-labelledby="leave-area-question" aria-describedby="leave-area-detail">
    <h2 id="leave-area-question">{{ question }}</h2>
    <p id="leave-area-detail">{{ detail }}</p>
    <div ref="choices" class="hub-leave-area-actions">
      <button type="button" class="ui-button" id="leave-area-stay" data-focus-key="leave-area-stay" @click="stay()">Stay here</button>
      <button
        type="button" class="ui-button" id="leave-area-leave" data-focus-key="leave-area-leave" data-variant="danger" :data-armed="armed ? '' : undefined"
        @click="leaveClicked"
      >{{ leave }}</button>
    </div>
  </section>
</template>
