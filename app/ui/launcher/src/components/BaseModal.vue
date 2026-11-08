<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { focusableElements } from "@shared/ui/focusable";
import { MODAL_HOST } from "../modal-host";

const props = withDefaults(defineProps<{
  labelledby: string;
  dismissible?: boolean;
  wide?: boolean;
}>(), { dismissible: true, wide: false });
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLElement | null>(null);
const host = inject(MODAL_HOST, null);
const target = computed(() => host?.value ?? "body");
let priorFocus: HTMLElement | null = null;
let shell: HTMLElement | null = null;

const focusable = () => (dialog.value ? focusableElements(dialog.value) : []);

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && props.dismissible) {
    event.preventDefault();
    emit("close");
    return;
  }
  if (event.key !== "Tab") return;
  const items = focusable();
  if (items.length === 0) {
    event.preventDefault();
    dialog.value?.focus();
    return;
  }
  const first = items[0]!;
  const last = items.at(-1)!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

onMounted(async () => {
  priorFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  shell = document.querySelector(".app-shell");
  if (shell) shell.inert = true;
  await nextTick();
  (dialog.value?.querySelector<HTMLElement>("[autofocus]") ?? focusable()[0] ?? dialog.value)?.focus();
});

onBeforeUnmount(() => {
  if (shell) shell.inert = false;
  priorFocus?.focus();
});
</script>

<template>
  <Teleport :to="target">
    <div class="modal-backdrop" @pointerdown.self="dismissible && emit('close')">
      <section ref="dialog" class="modal" :class="{ 'modal-wide': wide }" role="dialog" aria-modal="true" :aria-labelledby="labelledby" tabindex="-1" data-focus-target @keydown="onKeydown">
        <slot />
      </section>
    </div>
  </Teleport>
</template>

<style>
.modal-backdrop { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; padding: 16px; background: var(--scrim); backdrop-filter: blur(6px); }
/* One dialog width in the launcher and the Hub: 420px, and 16px clear of the edges when narrower. */
.modal { width: min(420px, 100%); padding: 24px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface-raised); box-shadow: var(--shadow-pop); container: modal / inline-size; }
.modal-head { display: flex; justify-content: space-between; align-items: center; }
.modal h2 { margin: 0; font-size: var(--fs-xl); }
.modal details { margin: 18px 0; color: var(--muted); }
.modal.modal-wide { width: min(650px, 100%); }
.modal > form { display: grid; gap: 16px; }
/* Buttons that no longer fit side by side stack full width, the last (primary) action at the bottom. */
.modal .form-actions { flex-wrap: wrap; }
@container modal (width <= 240px) {
  .modal .form-actions { flex-direction: column; align-items: stretch; }
}
@media (max-width: 600px) {
  .modal { max-height: calc(100vh - 32px); overflow: auto; padding: 20px; }
}
@media (prefers-reduced-transparency: reduce) {
  .modal-backdrop { backdrop-filter: none; }
}
</style>
