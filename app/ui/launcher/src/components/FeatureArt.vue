<script setup lang="ts">
/**
 * A Feature's manifest icon on its kind's colours: the Compact row's tile, the Feature page's
 * header tile, and the Large card's picture until the feature has a capture of its own.
 */
import { computed } from "vue";
import type { CardFeature } from "../features";
import { featureIcon } from "../feature-icon";

const props = defineProps<{ feature: CardFeature; variant: "tile" | "head" | "picture" }>();
const icon = computed(() => featureIcon(props.feature.icon));
</script>

<template>
  <span class="feature-art" :class="[variant, `kind-${feature.kind}`]" aria-hidden="true"><component :is="icon" /></span>
</template>

<style scoped>
.kind-maps { --ink: var(--kind-maps); --tint: var(--kind-maps-tint); --glow: var(--kind-maps-glow); }
.kind-combat { --ink: var(--kind-combat); --tint: var(--kind-combat-tint); --glow: var(--kind-combat-glow); }
.kind-party { --ink: var(--kind-party); --tint: var(--kind-party-tint); --glow: var(--kind-party-glow); }
.kind-chat { --ink: var(--kind-chat); --tint: var(--kind-chat-tint); --glow: var(--kind-chat-glow); }
.kind-items { --ink: var(--kind-items); --tint: var(--kind-items-tint); --glow: var(--kind-items-glow); }
.kind-helpers { --ink: var(--kind-helpers); --tint: var(--kind-helpers-tint); --glow: var(--kind-helpers-glow); }
.feature-art { flex: none; display: grid; place-items: center; color: var(--ink); background: var(--tint); }
.tile { width: 40px; height: 40px; border-radius: var(--radius-md); }
.head { width: 64px; height: 64px; border-radius: var(--radius-lg); box-shadow: inset 0 0 0 1px var(--glow); }
.head svg { width: 30px; height: 30px; }
.picture { width: 100%; aspect-ratio: 16 / 10; max-height: 140px; border-bottom: 1px solid var(--line); background: radial-gradient(90% 80% at 75% 0%, var(--glow), transparent 70%), linear-gradient(180deg, var(--tint) 0%, var(--picture-floor) 100%); }
.picture svg { width: 44px; height: 44px; stroke-width: 1.5; }
</style>
