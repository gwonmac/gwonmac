<script setup lang="ts">
/**
 * One Feature's page: a header with its status and switch, then tabs. General holds its
 * README, a section for each part that runs with it (Team Apply in the Build Library), what it
 * and its parts use and what's new, with the facts beside them; Settings
 * (./FeatureSettings.vue) appears when this host draws an option or shortcut for it; Feedback
 * (./FeedbackForm.vue) sends a report that names the Feature. Reading happens here, on a page
 * with a way back (DESIGN.md). The launcher's Features tab and the Hub's Features section both
 * draw it; `embedded` is a Settings page (the Hub's or the launcher's gear), which opens at
 * Settings and has no launcher links and no Feedback tab.
 */
import { computed, ref, watch } from "vue";
import { Check, ChevronLeft, Code, Eye, MousePointerClick, PenLine, Globe, ShieldCheck } from "lucide-vue-next";
import { folderForId, type FeatureId } from "@shared/feature-contracts";
import { featureUses, type FeatureUses } from "@shared/feature-uses";
import type { LauncherExternalLink, LauncherFeedback, LauncherSnapshot } from "@shared/launcher-contracts";
import { RELEASE_REPO } from "@shared/project-identity";
import type { ReleaseStage } from "@shared/release";
import type { SettingsTarget } from "@shared/settings-catalogue";
import { navigateTabs } from "@shared/ui/focusable";
import type { InGamePatch, InGameSettings, InGameTools } from "../settings-host";
import type { PerformSave } from "../save-status";
import { REGION_WORDS, cardFeature, changelogOf, featureStageLabel, presenceTag, readmeBlocks, type CardFeature } from "../features";
import { switchOf, type FeatureStatus } from "@shared/feature-status";
import DiscordIcon from "./DiscordIcon.vue";
import FeatureArt from "./FeatureArt.vue";
import FeatureSettings, { hasFeatureSettings } from "./FeatureSettings.vue";
import FeedbackForm from "./FeedbackForm.vue";
import MarkdownBody from "./MarkdownBody.vue";
import MarkdownInline from "./MarkdownInline.vue";

const props = withDefaults(defineProps<{
  feature: CardFeature;
  status: FeatureStatus;
  settings: InGameSettings;
  shortcuts: LauncherSnapshot["shortcuts"];
  api?: InGameTools | undefined;
  save: (patch: InGamePatch) => Promise<void>;
  performSave: PerformSave;
  appVersion: string;
  /** The stage this build shows: which options the page draws (app/shared/release.ts). */
  stage: ReleaseStage;
  /** Drawn inside the Hub's Settings page: its status line reports saves, and links to the launcher and the web stay text. */
  embedded?: boolean;
  /** Sends the Feedback tab's report; absent: no Feedback tab. */
  sendFeedback?: ((feedback: LauncherFeedback) => Promise<void>) | undefined;
  /** The Features without a switch of their own that run with this one (Team Apply in the Build Library), each a section of General. */
  parts?: readonly Readonly<{ feature: CardFeature; status: FeatureStatus }>[];
}>(), { api: undefined, embedded: false, sendFeedback: undefined, parts: () => [] });
const emit = defineEmits<{
  back: [];
  toggle: [on: boolean];
  turnOn: [feature: CardFeature];
  open: [id: FeatureId];
  settings: [target: SettingsTarget];
  external: [kind: LauncherExternalLink];
  url: [url: string];
  link: [actionId: string];
}>();

type Tab = "general" | "settings" | "feedback";
const tabs = computed(() => [
  { id: "general" as const, name: "General" },
  ...(hasFeatureSettings(props.feature, props.stage, props.settings) ? [{ id: "settings" as const, name: "Settings" }] : []),
  ...(props.sendFeedback && !props.embedded ? [{ id: "feedback" as const, name: "Feedback" }] : []),
]);
/** Inside Settings (the Hub's, or the launcher's gear) a page opens at its controls; in the Features tab, at General. */
const firstTab = (): Tab => props.embedded && tabs.value.some((each) => each.id === "settings") ? "settings" : "general";
const chosen = ref<Tab>(firstTab());
/** The chosen tab while this Feature has it; General otherwise. */
const tab = computed<Tab>(() => tabs.value.some((each) => each.id === chosen.value) ? chosen.value : "general");
watch(() => props.feature.id, () => { chosen.value = firstTab(); });
/** Settings search opens the page at an option, which lives on the Settings tab. */
function show(next: Tab) { chosen.value = next; }
defineExpose({ show });

const reason = computed(() => props.status.resolution.on ? null : props.status.resolution.reason);
const readme = computed(() => readmeBlocks(props.feature, !props.embedded));
const versions = computed(() => changelogOf(props.feature, !props.embedded));
/** Each part's README; its reason shows only when this Feature runs and the part does not (a check it failed). */
const partSections = computed(() => props.parts.map(({ feature, status }) => ({
  feature,
  readme: readmeBlocks(feature, !props.embedded),
  reason: props.status.resolution.on && !status.resolution.on ? status : null,
})));
/** What the Feature and its parts use, each line once. */
const uses = computed(() => {
  const all = [props.feature, ...props.parts.map((part) => part.feature)].map(featureUses);
  const merged = (pick: (each: FeatureUses) => readonly string[]) => [...new Set(all.flatMap(pick))];
  return { sees: merged((each) => each.sees), draws: merged((each) => each.draws), does: merged((each) => each.does), network: merged((each) => each.network) };
});
const usesGame = computed(() => uses.value.sees.length + uses.value.draws.length + uses.value.does.length > 0);
const needs = computed(() => ("requires" in props.feature ? props.feature.requires : []).flatMap((id) => cardFeature(id) ?? []));
/** The switch the header button moves; Settings search opens the page at it. */
const switchSetting = computed(() => `tool:${switchOf(props.feature)}`);
/** "Beta" or "Dev" beside the name of a Feature still in development: Beta ships in every build, Dev only in development builds. */
const stageLabel = computed(() => featureStageLabel(props.feature));
/** How the player meets the Feature: on screen, from the Hub or its shortcut, or on its own. */
const howToUse = computed(() => presenceTag(props.feature, props.shortcuts));
const source = computed(() => `https://github.com/${RELEASE_REPO}/tree/main/app/features/${folderForId(props.feature.id)}`);
/** What the Feedback tab sends and shows about the Feature: the status line in words. */
const feedbackFeature = computed(() => ({
  id: props.feature.id,
  name: props.feature.name,
  state: props.status.resolution.on ? "on" as const : props.status.resolution.reason,
  status: props.status.resolution.on ? "On" : props.status.text,
}));
</script>

<template>
  <article class="feature-page">
    <button class="quiet back" @click="emit('back')"><ChevronLeft aria-hidden="true" />Features</button>

    <header class="feature-head">
      <FeatureArt :feature="feature" variant="head" />
      <div class="head-copy">
        <h1 tabindex="-1">{{ feature.name }}<span v-if="stageLabel" class="chip accent stage-label">{{ stageLabel }}</span></h1>
        <p class="head-summary">{{ feature.summary }}</p>
        <p id="feature-status" class="head-status" :class="status.resolution.on ? 'on' : status.tone">
          <template v-if="status.resolution.on"><Check aria-hidden="true" />On</template>
          <template v-else-if="status.needs">Needs <button class="text-link" @click="emit('open', status.needs.id)">{{ status.needs.name }}</button>. Turn it on first.</template>
          <template v-else-if="reason === 'needs-update'">{{ status.text }} <button class="text-link" @click="emit('settings', { section: 'updates' })">Check for updates</button></template>
          <template v-else>{{ status.text }}</template>
        </p>
      </div>
      <div class="head-action">
        <button v-if="status.needs" class="primary" @click="emit('turnOn', status.needs)">Turn on {{ status.needs.name }}</button>
        <button v-else :class="status.checked ? 'secondary' : 'primary'" :disabled="status.locked" :data-setting="switchSetting" aria-describedby="feature-status" @click="emit('toggle', !status.checked)">{{ status.checked ? "Turn off" : "Turn on" }}</button>
      </div>
    </header>

    <div v-if="tabs.length > 1" class="segmented feature-tabs" role="tablist" :aria-label="`${feature.name} page`" @keydown="navigateTabs">
      <button v-for="each in tabs" :id="`feature-tab-${each.id}`" :key="each.id" role="tab" :tabindex="tab === each.id ? 0 : -1" :aria-selected="tab === each.id" :aria-controls="`feature-panel-${each.id}`" @click="show(each.id)">{{ each.name }}</button>
    </div>

    <div v-if="tab === 'general'" id="feature-panel-general" class="feature-layout" :role="tabs.length > 1 ? 'tabpanel' : undefined" :aria-labelledby="tabs.length > 1 ? 'feature-tab-general' : undefined">
      <div class="feature-main">
        <section aria-labelledby="about-title">
          <h2 id="about-title">About</h2>
          <MarkdownBody class="readme" :blocks="readme" @link="emit('link', $event)" />
        </section>

        <section v-for="part in partSections" :key="part.feature.id" :aria-labelledby="`part-${part.feature.id}`">
          <h2 :id="`part-${part.feature.id}`">{{ part.feature.name }}</h2>
          <p v-if="part.reason" class="part-reason" :class="part.reason.tone">{{ part.reason.text }}</p>
          <MarkdownBody class="readme" :blocks="part.readme" @link="emit('link', $event)" />
        </section>

        <section aria-labelledby="uses-title">
          <h2 id="uses-title">What it uses</h2>
          <div v-if="usesGame" class="uses">
            <div v-if="uses.sees.length" class="use"><span class="use-icon" aria-hidden="true"><Eye /></span><h3>Sees in the game</h3><ul><li v-for="line in uses.sees" :key="line">{{ line }}</li></ul></div>
            <div v-if="uses.draws.length" class="use"><span class="use-icon" aria-hidden="true"><PenLine /></span><h3>Draws on the game screen</h3><ul><li v-for="line in uses.draws" :key="line">{{ line }}</li></ul></div>
            <div v-if="uses.does.length" class="use"><span class="use-icon" aria-hidden="true"><MousePointerClick /></span><h3>Does in the game</h3><ul><li v-for="line in uses.does" :key="line">{{ line }}</li></ul></div>
          </div>
          <p class="pledges">
            <span><Globe aria-hidden="true" />{{ uses.network.length ? `Connects to ${uses.network.join(" and ")}` : "No internet connection" }}</span>
            <span><ShieldCheck aria-hidden="true" />Never reads your account or password</span>
          </p>
          <p v-if="usesGame" class="uses-note">Before this Feature runs, GWonMac checks each game item above on this Guild Wars build.</p>
        </section>

        <section v-if="versions.length" aria-labelledby="new-title">
          <h2 id="new-title">What’s new</h2>
          <div v-for="(entry, index) in versions" :key="entry.version" class="version">
            <span><strong>{{ entry.featureVersion ? `v${entry.featureVersion}` : entry.version }}</strong><small v-if="entry.featureVersion" class="app-version">GWonMac {{ entry.version }}</small><small v-if="index === 0 && entry.version === appVersion">This version</small></span>
            <ul><li v-for="(item, itemIndex) in entry.items" :key="itemIndex"><MarkdownInline :parts="item" @link="emit('link', $event)" /></li></ul>
          </div>
        </section>
      </div>

      <aside class="facts" aria-label="About this Feature">
        <dl>
          <div><dt>Version</dt><dd>{{ feature.version }}<template v-if="stageLabel"> · {{ stageLabel }}</template></dd></div>
          <div v-if="howToUse"><dt>How to use</dt><dd>{{ howToUse }}</dd></div>
          <div><dt>Works in</dt><dd>{{ REGION_WORDS[feature.region] }}</dd></div>
          <div v-if="needs.length"><dt>Needs</dt><dd><template v-for="(each, index) in needs" :key="each.id"><template v-if="index > 0">, </template><button class="text-link" @click="emit('open', each.id)">{{ each.name }}</button></template></dd></div>
          <div v-if="'hub' in feature"><dt>In the Hub</dt><dd>Type <kbd>{{ feature.name.toLowerCase() }}</kbd></dd></div>
          <div v-if="versions.length"><dt>Last changed</dt><dd>GWonMac {{ versions[0]!.version }}</dd></div>
        </dl>
        <div v-if="!embedded" class="fact-links">
          <button class="text-link" @click="emit('url', source)"><Code aria-hidden="true" />Source code</button>
        </div>
      </aside>
    </div>

    <div v-else-if="tab === 'settings'" id="feature-panel-settings" class="feature-panel" role="tabpanel" aria-labelledby="feature-tab-settings">
      <FeatureSettings :feature="feature" :stage="stage" :settings="settings" :shortcuts="shortcuts" :api="api" :save="save" :perform-save="performSave" />
    </div>

    <div v-else-if="tab === 'feedback' && sendFeedback" id="feature-panel-feedback" class="feature-layout" role="tabpanel" aria-labelledby="feature-tab-feedback">
      <section class="feedback-card" aria-labelledby="feedback-title">
        <h2 id="feedback-title">Tell us about {{ feature.name }}</h2>
        <FeedbackForm :send="sendFeedback" :app-version="appVersion" :feature="feedbackFeature" />
      </section>
      <aside class="facts feedback-aside" aria-label="Other ways to reach us">
        <div class="report-tips">
          <h3>What helps us most</h3>
          <ul><li>What you did, step by step</li><li>What you expected</li><li>What happened instead</li></ul>
        </div>
        <div class="fact-links">
          <button class="text-link" @click="emit('external', 'discord')"><DiscordIcon aria-hidden="true" />Ask on Discord</button>
          <button class="text-link" @click="emit('url', source)"><Code aria-hidden="true" />Source code</button>
        </div>
      </aside>
    </div>
  </article>
</template>

<style scoped>
.feature-page { width: 100%; max-width: 1116px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
.back { align-self: flex-start; min-height: 32px; margin: -12px 0 0 -10px; padding: 6px 10px; border-radius: var(--radius-sm); font-size: var(--fs-sm); }
.back svg { width: 16px; height: 16px; }
.feature-head { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 22px; margin-top: -8px; }
.head-copy { flex: 1 1 360px; min-width: 0; display: grid; gap: 6px; }
.head-copy h1 { margin: 0; font-size: var(--fs-page); line-height: 1.1; }
.head-copy p { margin: 0; }
.head-summary { color: var(--text-soft); font-size: 15px; }
.stage-label { margin-left: 12px; font-weight: 600; vertical-align: middle; }
/* Inline flow, not flex: a flex gap would split "Needs Travel." around its link. */
.head-status { font-size: var(--fs-sm); }
.head-status svg { width: 16px; height: 16px; margin-right: 6px; vertical-align: -3px; }
.on { color: var(--success); font-weight: 600; }
.part-reason { margin: 0 0 10px; font-size: var(--fs-sm); }
.warning { color: var(--warning); }
.head-action .primary, .head-action .secondary { min-width: 132px; }
/* A text link inside a sentence takes no padding of its own. */
.head-status .text-link, .facts dd .text-link { padding: 0; font: inherit; }

.feature-tabs { align-self: flex-start; }

.feature-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 48px; align-items: start; }
.feature-panel { max-width: 760px; }
.feature-main { min-width: 0; display: flex; flex-direction: column; gap: 40px; }
.feature-main section { display: flex; flex-direction: column; gap: 12px; }
.feature-main h2 { margin: 0; font-size: var(--fs-lg); font-weight: 600; }
.readme { font-size: 15px; }
.uses { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.use { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface-row); }
.use-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); color: var(--gold-text); background: var(--gold-tint-strong); }
.use-icon svg { width: 18px; height: 18px; }
.use h3 { margin: 0; font-size: var(--fs-md); font-weight: 600; }
.use ul { margin: 0; padding-left: 18px; color: var(--text-soft); font-size: var(--fs-sm); line-height: 1.6; }
.pledges { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 0; font-size: var(--fs-sm); }
.pledges span { display: inline-flex; align-items: center; gap: 6px; }
.pledges svg { width: 15px; height: 15px; color: var(--success); }
.uses-note { max-width: 660px; margin: 0; font-size: var(--fs-sm); }

.version { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.version > span { display: grid; gap: 4px; align-content: start; font-size: var(--fs-md); }
.version small { color: var(--gold-text); font-size: var(--fs-xs); }
.version small.app-version { color: var(--muted); }
.version ul { margin: 0; padding-left: 18px; color: var(--text-soft); font-size: var(--fs-md); line-height: 1.6; }

.facts { position: sticky; top: 0; display: flex; flex-direction: column; gap: 16px; }
.facts dl { margin: 0; padding: 4px 20px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface-solid); }
.facts dl > div { display: grid; gap: 4px; padding: 13px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-md); }
.facts dl > div:last-child { border-bottom: 0; }
.facts dt { color: var(--muted); font-size: var(--fs-xs); }
.facts dd { margin: 0; }
.facts kbd { display: inline-grid; place-items: center; min-width: 24px; height: 22px; padding: 0 6px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--control); font: inherit; font-size: var(--fs-xs); }
.fact-links { display: grid; justify-items: start; padding: 4px 20px; }
.fact-links svg { width: 16px; height: 16px; }

.feature-layout > .feedback-card { margin-top: 0; }
.report-tips { display: grid; gap: 8px; padding: 0 20px; }
.report-tips h3 { margin: 0; font-size: var(--fs-md); font-weight: 600; }
.report-tips ul { margin: 0; padding-left: 18px; color: var(--muted); font-size: var(--fs-sm); line-height: 1.6; }

@media (max-width: 980px) {
  .feature-layout { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .facts { position: static; }
}
</style>
