<script setup lang="ts">
// `::media-placeholder` in the docs: a screenshot or video that is still to be made. Global, so the Markdown renderer
// finds it by its tag. The launcher's Guide draws the same block from the same Markdown (app/shared/launcher-markdown.ts).
defineProps<{ type?: "image" | "video" }>();
</script>

<template>
  <figure class="media-placeholder">
    <Icon v-if="type === 'video'" name="lucide:clapperboard" class="media-placeholder-icon" aria-hidden="true" />
    <Icon v-else name="lucide:image" class="media-placeholder-icon" aria-hidden="true" />
    <figcaption>
      <strong>{{ type === "video" ? "Video to come" : "Screenshot to come" }}</strong>
      <slot />
    </figcaption>
  </figure>
</template>

<style scoped>
.media-placeholder {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  color: var(--muted-foreground);
  font-size: 0.875rem;
}
.media-placeholder-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--primary);
}
.media-placeholder strong {
  display: block;
  color: var(--foreground);
}
</style>
