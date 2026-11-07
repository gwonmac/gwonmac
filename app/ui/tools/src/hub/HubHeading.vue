<script setup lang="ts">
/**
 * The Hub's title bar: Back, the name, the breadcrumb path to the current page, the player's
 * context, then lock and close. The window owner (hub-window.ts) adds its move hint and keeps
 * the lock's state, so the lock is static here.
 */
import type { HubViewModel } from '../../../../shared/ui/hub-view';

defineProps<{ back: HubViewModel['back']; caption: HubViewModel['caption']; crumbs: HubViewModel['crumbs']; context: string }>();
</script>

<template>
  <header class="hub-heading ui-window-head">
    <button
      class="ui-button hub-back" data-variant="quiet" aria-label="Back" :hidden="back.hidden"
      :title="back.destination === undefined ? undefined : 'Back (⌘⌫)'" :aria-keyshortcuts="back.destination === undefined ? undefined : 'Meta+Backspace'"
      :aria-description="back.destination === undefined ? undefined : `Return to ${back.destination}`"
    >{{ back.destination === undefined ? '← Back' : '←' }}</button>
    <span id="hub-name" class="hub-name">Hub</span>
    <span id="hub-title-separator" hidden>—</span>
    <nav class="hub-breadcrumbs" aria-label="Hub breadcrumb">
      <template v-for="(crumb, index) in crumbs" :key="index">
        <button type="button" class="hub-crumb" @click="crumb.open()">{{ crumb.title }}</button>
        <span aria-hidden="true">›</span>
      </template>
      <span id="hub-caption" class="hub-caption" role="heading" aria-level="1" :aria-current="caption.current ? 'page' : undefined">{{ caption.text }}</span>
    </nav>
    <span class="hub-context" v-text="context"></span>
    <button class="ui-window-lock hub-lock" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path class="lock-shackle" d="M7 11V7a5 5 0 0 1 10 0v4" /><rect x="5" y="11" width="14" height="10" rx="2" /></svg>
    </button>
    <button class="ui-window-close hub-close" aria-label="Close Hub" title="Close Hub">×</button>
  </header>
</template>
