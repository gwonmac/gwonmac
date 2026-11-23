<script setup lang="ts">
/**
 * The launcher's one help destination: the bundled Guide, open issues in
 * ArenaNet's official client, and where to report a problem (./FeedbackForm.vue).
 */
import { computed, nextTick, ref } from "vue";
import { ExternalLink, Github, Info, Smartphone } from "lucide-vue-next";
import type { LauncherExternalLink, LauncherFeedback } from "@shared/launcher-contracts";
import type { MarkdownBlock, MarkdownInline as Inline } from "@shared/launcher-markdown";
import type { SettingsTarget } from "@shared/settings-catalogue";
import { GUIDE_HELP_PAGES, GUIDE_PAGES, parseGuideAction, type GuidePageId } from "../guide";
import DiscordIcon from "./DiscordIcon.vue";
import FeedbackForm from "./FeedbackForm.vue";
import MarkdownBody from "./MarkdownBody.vue";
import MarkdownInline from "./MarkdownInline.vue";

export type HelpPage = GuidePageId | "report";

const props = defineProps<{ send: (feedback: LauncherFeedback) => Promise<void>; appVersion?: string | undefined; page?: HelpPage | undefined }>();
const emit = defineEmits<{ external: [kind: LauncherExternalLink]; url: [url: string]; settings: [target: SettingsTarget]; link: [actionId: string] }>();

const active = ref<HelpPage>(props.page ?? "known-issues");
const content = ref<HTMLElement | null>(null);
const guidePage = computed(() => GUIDE_PAGES.find((candidate) => candidate.id === active.value));
const helpNav = GUIDE_PAGES.filter((candidate) => GUIDE_HELP_PAGES.includes(candidate.id));
const featureNav = GUIDE_PAGES.filter((candidate) => !GUIDE_HELP_PAGES.includes(candidate.id));

async function show(target: HelpPage, anchor?: string) {
  active.value = target;
  await nextTick();
  const heading = anchor ? content.value?.querySelector<HTMLElement>(`#${CSS.escape(anchor)}`) : null;
  if (heading) heading.scrollIntoView({ block: "start" });
  else content.value?.closest(".page")?.scrollTo({ top: 0 });
}

function follow(actionId: string) {
  const action = parseGuideAction(actionId);
  if (action?.kind === "guide") void show(action.page, action.anchor);
  else if (action?.kind === "settings") emit("settings", action.target);
  else if (action?.kind === "url") emit("url", action.url);
  else if (action?.kind === "feature") emit("link", actionId);
}

// A known issue is a `##` section of the known-issues page; its
// "**What you can do:**" paragraph becomes the highlighted workaround.
const HINT = "What you can do:";
const issues = computed(() => {
  const blocks = GUIDE_PAGES.find((candidate) => candidate.id === "known-issues")!.blocks;
  const result: { title: string; symptom: MarkdownBlock[]; hint: readonly Inline[] }[] = [];
  for (const block of blocks) {
    if (block.type === "heading" && !block.level) result.push({ title: block.text, symptom: [], hint: [] });
    else if (!result.length) continue;
    else if (block.type === "paragraph" && block.content[0]?.emphasis === "strong" && block.content[0].text === HINT) {
      result.at(-1)!.hint = block.content.slice(1).map((part, index) => index === 0 ? { ...part, text: part.text.trimStart() } : part);
    } else result.at(-1)!.symptom.push(block);
  }
  return result;
});
const issueIntro = computed(() => {
  const blocks = GUIDE_PAGES.find((candidate) => candidate.id === "known-issues")!.blocks;
  const first = blocks.findIndex((block) => block.type === "heading");
  return blocks.slice(0, first < 0 ? blocks.length : first);
});

</script>

<template>
  <section class="page help-page">
    <div class="help-layout">
      <nav class="help-nav" aria-label="Help">
        <div class="help-nav-group">
          <h2>Get help</h2>
          <button v-for="item in helpNav" :key="item.id" :class="{ active: active === item.id }" :aria-current="active === item.id ? 'page' : undefined" @click="show(item.id)">{{ item.title }}</button>
          <button :class="{ active: active === 'report' }" :aria-current="active === 'report' ? 'page' : undefined" @click="show('report')">Report a problem</button>
        </div>
        <div class="help-nav-group">
          <h2>Features</h2>
          <button v-for="item in featureNav" :key="item.id" :class="{ active: active === item.id }" :aria-current="active === item.id ? 'page' : undefined" @click="show(item.id)">{{ item.title }}</button>
        </div>
      </nav>

      <div ref="content" class="help-content">
        <template v-if="active === 'known-issues'">
          <div class="page-head"><div><h1>Known issues</h1><MarkdownBody class="help-intro" :blocks="issueIntro" @link="follow" /></div></div>
          <ul class="issue-catalogue" aria-label="Known issue list">
            <li v-for="issue in issues" :key="issue.title" class="issue-card">
              <h2>{{ issue.title }}</h2>
              <MarkdownBody :blocks="issue.symptom" @link="follow" />
              <div v-if="issue.hint.length" class="workaround"><Info /><div><strong>What you can do</strong><p><MarkdownInline :parts="issue.hint" @link="follow" /></p></div></div>
            </li>
          </ul>
        </template>

        <template v-else-if="active === 'report'">
          <div class="page-head"><div><h1>Report a problem</h1><p>Ask on Discord, open a GitHub issue, or send us a message below.</p></div></div>
          <section class="issue-help" aria-labelledby="issue-help-title">
            <span class="issue-help-icon"><Smartphone /></span>
            <div>
              <h2 id="issue-help-title">Check whether the problem also happens on your phone</h2>
              <ol>
                <li>Repeat the same action in ArenaNet’s official Guild Wars Reforged phone app, if possible.</li>
                <li>Write down the map, action, and whether the game crashed.</li>
                <li>If it also happens on your phone, report it to ArenaNet. If it happens only on Mac, report it to gwonmac.</li>
              </ol>
              <div class="issue-help-actions">
                <button class="secondary" @click="emit('external', 'discord')"><DiscordIcon />Ask on Discord</button>
                <button class="secondary" @click="emit('external', 'bugReport')"><Github />Report Mac issue</button>
                <button class="secondary" @click="emit('external', 'arenaNetSupport')">Report to ArenaNet <ExternalLink /></button>
              </div>
              <p class="issue-help-note">To attach diagnostics, choose <strong>Help → Diagnostics → Export Recent Diagnostics…</strong> in a game window.</p>
            </div>
          </section>

          <section class="feedback-card" aria-labelledby="feedback-title">
            <h2 id="feedback-title">Tell us about a problem or an idea</h2>
            <FeedbackForm :send="send" :app-version="appVersion" />
          </section>
        </template>

        <article v-else-if="guidePage" class="guide-page">
          <div class="page-head"><div><h1>{{ guidePage.title }}</h1><p>{{ guidePage.summary }}</p></div></div>
          <MarkdownBody :blocks="guidePage.blocks" @link="follow" />
        </article>
      </div>
    </div>
  </section>
</template>
