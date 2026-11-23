<script setup lang="ts">
/**
 * The status line of a ../save-status.ts host: saving, what was saved and when it applies, or
 * which setting could not be saved, with Retry and, where the host keeps the refused change on
 * screen, Revert. The live region stays in the page while empty. The host places it.
 */
import type { SaveStatus } from "../save-status";

withDefaults(defineProps<{
  status: SaveStatus;
  /** Says how changes save while nothing has happened yet; a host without a status bar leaves it out. */
  idleNote?: boolean;
}>(), { idleNote: true });
</script>

<template>
  <footer class="save-status" :class="{ 'save-failed': status.state.value === 'failed', 'save-idle': status.state.value === 'idle' }">
    <span class="status-line" role="status"><template v-if="status.state.value === 'saving'">Saving…</template><template v-else-if="status.state.value === 'saved'">{{ status.savedNote.value }}</template><template v-else-if="status.state.value === 'idle' && idleNote">Changes save right away and apply in every game window.</template></span>
    <template v-if="status.state.value === 'failed'">
      <span class="status-alert" role="alert"><strong>{{ status.edited.value.label }} could not be saved.</strong></span>
      <span class="save-actions"><button :ref="status.holdRetryButton" class="secondary small" @click="status.retry">Retry</button><button v-if="status.keepsChange" class="secondary small" @click="status.revert">Revert</button></span>
    </template>
  </footer>
</template>

<style scoped>
.save-status { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; color: var(--muted); }
.save-status.save-failed { color: var(--danger-text); background: var(--danger-tint); }
.status-line, .status-alert { flex: 1 1 260px; }
/* The live region stays in the page while empty; it takes no room. */
.status-line:empty { flex: 0 0 0; margin-inline-end: -16px; }
.save-actions { display: flex; flex-wrap: wrap; gap: 8px; }
</style>
