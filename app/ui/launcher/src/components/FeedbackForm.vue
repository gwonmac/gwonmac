<script setup lang="ts">
/**
 * The launcher's one feedback form: Help's "Report a problem" and each Feature page's
 * Feedback tab. On a Feature's page the report names that Feature and whether it ran, and
 * the prompts speak of it. The form lists everything a report carries before it is sent,
 * and shows success only after main confirms that Basin accepted it.
 */
import { computed, ref } from "vue";
import { Check, Lightbulb, MessageCircle, TriangleAlert } from "lucide-vue-next";
import {
  LAUNCHER_FEEDBACK_MESSAGE_LIMIT,
  parseLauncherFeedback,
  type LauncherFeedback,
  type LauncherFeedbackFeature,
  type LauncherFeedbackKind,
} from "@shared/launcher-contracts";

const props = defineProps<{
  send: (feedback: LauncherFeedback) => Promise<void>;
  appVersion?: string | undefined;
  /** The Feature the report is about, with its name and the status line the page shows. */
  feature?: (LauncherFeedbackFeature & { name: string; status: string }) | undefined;
}>();

const KINDS = [
  { id: "problem", label: "Problem", icon: TriangleAlert },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "other", label: "Something else", icon: MessageCircle },
] as const;

const kind = ref<LauncherFeedbackKind>("problem");
const message = ref("");
const email = ref("");
const state = ref<"editing" | "sending" | "sent" | "failed">("editing");
// The same parser main applies, so the button enables only for a report main accepts.
const feedback = computed(() => {
  try {
    return parseLauncherFeedback({
      kind: kind.value,
      message: message.value,
      ...(email.value.trim() ? { email: email.value } : {}),
      ...(props.feature ? { feature: { id: props.feature.id, state: props.feature.state } } : {}),
    });
  } catch {
    return null;
  }
});
const prompt = computed(() => {
  const name = props.feature?.name;
  if (kind.value === "idea") return name ? `What would make ${name} better for you?` : "What would you like GWonMac to do?";
  if (kind.value === "other") return name ? `What would you like to tell us about ${name}?` : "What would you like to tell us?";
  return name ? `What did you do with ${name}, and what happened? A short description is enough.` : "What did you do, and what happened? A short description is enough.";
});
const attached = computed(() => [
  ...(props.feature ? [["Feature", props.feature.name], ["Its status", props.feature.status]] as const : []),
  ["GWonMac", props.appVersion ?? "This version"],
  ["macOS", "This Mac's version"],
] as const);

async function submit() {
  if (!feedback.value || state.value === "sending") return;
  state.value = "sending";
  try {
    await props.send(feedback.value);
    message.value = "";
    state.value = "sent";
  } catch {
    state.value = "failed";
  }
}
</script>

<template>
  <div v-if="state === 'sent'" class="feedback-sent" role="status"><Check /><strong>Thanks, we got your message{{ feature ? ` about ${feature.name}` : "" }}.</strong><button class="text-link" @click="state = 'editing'">Send another</button></div>
  <form v-else class="feedback-form" @submit.prevent="submit">
    <fieldset class="feedback-kinds">
      <legend>What is it about?</legend>
      <label v-for="each in KINDS" :key="each.id" :class="{ selected: kind === each.id }"><input v-model="kind" type="radio" name="feedback-kind" :value="each.id" /><component :is="each.icon" aria-hidden="true" />{{ each.label }}</label>
    </fieldset>
    <label>Message<textarea v-model="message" rows="6" :maxlength="LAUNCHER_FEEDBACK_MESSAGE_LIMIT" :placeholder="prompt" /></label>
    <label>Email (optional)<input v-model="email" type="email" autocomplete="email" placeholder="Only if you want an answer" /></label>
    <div class="feedback-attached">
      <p>Sent with your message</p>
      <dl><div v-for="[term, value] in attached" :key="term"><dt>{{ term }}</dt><dd>{{ value }}</dd></div></dl>
      <p class="feedback-note">It goes to the GWonMac team through Basin, a form service. Nothing else is sent: no account, character or game data.</p>
    </div>
    <p v-if="state === 'failed'" class="inline-message" role="alert">Your message could not be sent. Check your connection and try again, or ask on Discord.</p>
    <div class="form-actions"><button type="submit" class="primary" :disabled="!feedback || state === 'sending'">{{ state === 'sending' ? 'Sending…' : 'Send' }}</button></div>
  </form>
</template>

<style scoped>
.feedback-kinds { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; border: 0; }
.feedback-kinds legend { margin-bottom: 8px; padding: 0; color: var(--text-soft); font-size: var(--fs-md); }
.feedback-kinds label { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 0 14px; border: 1px solid var(--line); border-radius: var(--radius-md); color: var(--muted); background: var(--sunken); cursor: pointer; }
.feedback-kinds label:hover { color: var(--text); }
.feedback-kinds label.selected { color: var(--text); background: var(--surface-selected); }
.feedback-kinds label:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
.feedback-kinds input { position: absolute; opacity: 0; pointer-events: none; }
.feedback-kinds svg { width: 16px; height: 16px; }
.feedback-attached { display: grid; gap: 8px; padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--sunken); }
.feedback-attached > p:first-child { margin: 0; color: var(--text-soft); font-size: var(--fs-sm); font-weight: 600; }
.feedback-attached dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 16px; margin: 0; font-size: var(--fs-sm); }
.feedback-attached dl > div { display: contents; }
.feedback-attached dt { color: var(--muted); }
.feedback-attached dd { margin: 0; color: var(--text); }
</style>
