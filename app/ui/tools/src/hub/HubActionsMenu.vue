<script setup lang="ts">
/** The Actions menu over the footer, verb first, in its Primary, Details and Personalize sections. */
import type { HubViewModel } from '../../../../shared/ui/hub-view';

defineProps<{ menu: HubViewModel['menu'] }>();
</script>

<template>
  <div class="hub-menu" role="menu" aria-label="Actions" :hidden="menu.hidden" :style="menu.bottom === undefined ? undefined : { bottom: menu.bottom }">
    <template v-for="(item, index) in menu.items" :key="index">
      <p v-if="menu.items[index - 1]?.section !== item.section" class="hub-menu-section" role="presentation">{{ item.section }}</p>
      <button
        type="button" class="hub-menu-item" role="menuitem" :disabled="!!item.disabled" :title="item.reason" :aria-description="item.reason"
        :data-variant="item.destructive ? 'danger' : undefined" @click="item.click($event)"
      >
        <span>{{ item.label }}</span>
        <span v-if="item.keys" class="hub-menu-keys"><kbd v-for="(cap, at) in item.keys" :key="at" class="ui-kbd">{{ cap }}</kbd></span>
      </button>
    </template>
  </div>
</template>
