<script setup lang="ts">
/** Hub art that leaves the DOM when it fails to load, so a broken image never shows. */
import { ref, watch } from 'vue';

const props = defineProps<{ src: string }>();
const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });
</script>

<template>
  <img v-if="!failed" :src="src" alt="" @error="failed = true">
</template>
