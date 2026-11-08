<script setup lang="ts">
// `:setting[Name]{to="section"}` in the docs: a setting named in a guide page. Global, so the Markdown renderer finds
// it by its tag. In the launcher's built-in Guide it opens that control; a browser has no Settings page, so here it
// shows the name.
defineProps<{ to: string }>();
</script>

<template>
  <strong><slot /></strong>
</template>
