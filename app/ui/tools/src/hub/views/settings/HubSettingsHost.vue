<script setup lang="ts">
/**
 * The host of the Hub's Settings page. The launcher's Settings page mounts inside it and owns
 * its content; the host itself says only that Settings could not be loaded. The text is a
 * single interpolation, so a draw that does not change it never touches the launcher's page.
 */
import type { HubSettingsHostProps } from '../../../../../../shared/ui/hub-pages';

defineProps<HubSettingsHostProps>();
</script>

<template>
  <div class="hub-settings-host">{{ failed ? 'Settings could not be loaded. Use Settings in the launcher.' : '' }}</div>
</template>
