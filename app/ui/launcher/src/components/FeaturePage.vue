<script setup lang="ts">
/**
 * One Feature's page: its header with the switch as a button, its README, what it uses, its
 * options from the manifest's typed settings and shortcuts, what's new from its CHANGELOG, and
 * the facts beside them. Reading happens here, on a page with a way back (DESIGN.md).
 */
import { computed, ref } from "vue";
import { Bug, Check, ChevronLeft, Code, Eye, HardDrive, MousePointerClick, PenLine, Globe, ShieldCheck } from "lucide-vue-next";
import { FEATURE_KIND_LABELS, type FeatureId } from "@shared/feature-contracts";
import { featureUses } from "@shared/feature-uses";
import { SHORTCUT_LABELS } from "@shared/keyboard-shortcuts";
import type { LauncherExternalLink, LauncherNativeApi, LauncherSettingsPatch, LauncherSnapshot } from "@shared/launcher-contracts";
import type { SettingsTarget } from "@shared/settings-catalogue";
import { REGION_WORDS, cardFeature, changelogOf, featureOptions, readmeBlocks, type CardFeature, type FeatureOption, type FeatureStatus } from "../features";
import FeatureArt from "./FeatureArt.vue";
import FeatureSwitch from "./FeatureSwitch.vue";
import MarkdownBody from "./MarkdownBody.vue";
import MarkdownInline from "./MarkdownInline.vue";
import RangeControl from "./RangeControl.vue";
import ShortcutSetting from "./ShortcutSetting.vue";

const props = defineProps<{
  feature: CardFeature;
  status: FeatureStatus;
  snapshot: LauncherSnapshot;
  native: LauncherNativeApi | undefined;
  save: (patch: LauncherSettingsPatch) => Promise<void>;
}>();
const emit = defineEmits<{
  back: [];
  toggle: [on: boolean];
  turnOn: [feature: CardFeature];
  open: [id: FeatureId];
  settings: [target: SettingsTarget];
  external: [kind: LauncherExternalLink];
  link: [actionId: string];
}>();

const reason = computed(() => props.status.resolution.on ? null : props.status.resolution.reason);
const readme = computed(() => readmeBlocks(props.feature));
const versions = computed(() => changelogOf(props.feature));
const uses = computed(() => featureUses(props.feature));
const usesGame = computed(() => uses.value.sees.length + uses.value.draws.length + uses.value.does.length > 0);
const options = computed(() => featureOptions(props.feature));
const shortcuts = computed(() => "shortcuts" in props.feature ? props.feature.shortcuts : []);
const needs = computed(() => ("requires" in props.feature ? props.feature.requires : []).flatMap((id) => cardFeature(id) ?? []));
const settings = computed<Readonly<Record<string, unknown>>>(() => props.snapshot.settings);

const saveNote = ref<{ text: string; failed: boolean }>({ text: "Changes save right away and apply in every game window.", failed: false });
async function change(option: FeatureOption, value: unknown) {
  try {
    await props.save({ [option.key]: value });
    saveNote.value = { text: `Saved: ${option.label}.`, failed: false };
  } catch {
    saveNote.value = { text: `${option.label} could not be saved. Try again.`, failed: true };
  }
}
</script>

<template>
  <article class="feature-page">
    <button class="quiet back" @click="emit('back')"><ChevronLeft aria-hidden="true" />Features</button>

    <header class="feature-head">
      <FeatureArt :feature="feature" variant="head" />
      <div class="head-copy">
        <h1 tabindex="-1">{{ feature.name }}</h1>
        <p class="head-summary">{{ feature.summary }}</p>
        <p class="head-meta">{{ FEATURE_KIND_LABELS[feature.kind] }} · {{ REGION_WORDS[feature.region] }} · by the GWonMac project</p>
        <p id="feature-status" class="head-status" :class="status.resolution.on ? 'on' : status.tone">
          <template v-if="status.resolution.on"><Check aria-hidden="true" />On</template>
          <template v-else-if="status.needs">Needs <button class="inline-link" @click="emit('open', status.needs.id)">{{ status.needs.name }}</button>. Turn it on first.</template>
          <template v-else-if="reason === 'needs-update'">{{ status.text }} <button class="inline-link" @click="emit('settings', { section: 'updates' })">Check for updates</button></template>
          <template v-else>{{ status.text }}</template>
        </p>
      </div>
      <div class="head-action">
        <button v-if="status.needs" class="primary" @click="emit('turnOn', status.needs)">Turn on {{ status.needs.name }}</button>
        <button v-else :class="status.checked ? 'secondary' : 'primary'" :disabled="status.locked" aria-describedby="feature-status" @click="emit('toggle', !status.checked)">{{ status.checked ? "Turn off" : "Turn on" }}</button>
      </div>
    </header>

    <div class="feature-layout">
      <div class="feature-main">
        <section aria-labelledby="about-title">
          <h2 id="about-title">About</h2>
          <MarkdownBody class="readme" :blocks="readme" @link="emit('link', $event)" />
        </section>

        <section aria-labelledby="uses-title">
          <h2 id="uses-title">What it uses</h2>
          <div class="uses">
            <div v-if="uses.sees.length" class="use"><span class="use-icon" aria-hidden="true"><Eye /></span><h3>Sees in the game</h3><ul><li v-for="line in uses.sees" :key="line">{{ line }}</li></ul></div>
            <div v-if="uses.draws.length" class="use"><span class="use-icon" aria-hidden="true"><PenLine /></span><h3>Draws on the game screen</h3><ul><li v-for="line in uses.draws" :key="line">{{ line }}</li></ul></div>
            <div v-if="uses.does.length" class="use"><span class="use-icon" aria-hidden="true"><MousePointerClick /></span><h3>Does in the game</h3><ul><li v-for="line in uses.does" :key="line">{{ line }}</li></ul></div>
            <div class="use"><span class="use-icon" aria-hidden="true"><HardDrive /></span><h3>Saves on this Mac</h3><ul><li>Its settings</li></ul></div>
          </div>
          <p class="pledges">
            <span><Globe aria-hidden="true" />{{ uses.network.length ? `Connects to ${uses.network.join(" and ")}` : "No internet connection" }}</span>
            <span><ShieldCheck aria-hidden="true" />Never reads your account or password</span>
          </p>
          <p v-if="usesGame" class="uses-note">Before this Feature runs, GWonMac checks each game item above on this Guild Wars build.</p>
        </section>

        <section v-if="options.length || shortcuts.length" aria-labelledby="settings-title" class="options">
          <h2 id="settings-title">Settings</h2>
          <p class="save-note" :class="{ failed: saveNote.failed }" :role="saveNote.failed ? 'alert' : 'status'">{{ saveNote.text }}</p>
          <div v-for="option in options" :key="option.key" class="row" :data-setting="option.key">
            <span class="row-label"><span :id="`option-${option.key}`">{{ option.label }}</span><small :id="`option-${option.key}-help`">{{ option.help }}</small></span>
            <FeatureSwitch v-if="option.kind === 'switch'" :checked="settings[option.key] === true" :label="option.label" :describedby="`option-${option.key}-help`" @change="change(option, $event)" />
            <RangeControl v-else-if="option.kind === 'range'" :label="option.label" :value="Number(settings[option.key])" :min="option.min" :max="option.max" @change="change(option, $event)" />
            <button v-else-if="option.kind === 'position'" class="secondary small" :aria-describedby="`option-${option.key}`" @click="change(option, option.fallback)">Put back</button>
            <button v-else class="secondary small" :aria-describedby="`option-${option.key}`" @click="emit('settings', option.target)">Change in Settings</button>
          </div>
          <div v-for="shortcut in shortcuts" :key="shortcut.action" class="row">
            <span class="row-label"><span>{{ SHORTCUT_LABELS[shortcut.action] }} shortcut</span></span>
            <ShortcutSetting :action="shortcut.action" :shortcuts="snapshot.shortcuts" :api="native?.tools" />
          </div>
        </section>

        <section v-if="versions.length" aria-labelledby="new-title">
          <h2 id="new-title">What’s new</h2>
          <div v-for="(entry, index) in versions" :key="entry.version" class="version">
            <span><strong>{{ entry.version }}</strong><small v-if="index === 0 && entry.version === snapshot.appUpdate.currentVersion">This version</small></span>
            <ul><li v-for="(item, itemIndex) in entry.items" :key="itemIndex"><MarkdownInline :parts="item" @link="emit('link', $event)" /></li></ul>
          </div>
        </section>
      </div>

      <aside class="facts" aria-label="About this Feature">
        <dl>
          <div><dt>Status</dt><dd :class="status.resolution.on ? 'on' : status.tone">{{ status.resolution.on ? "On" : status.text }}</dd></div>
          <div><dt>Works in</dt><dd>{{ REGION_WORDS[feature.region] }}</dd></div>
          <div><dt>Needs</dt><dd v-if="needs.length"><template v-for="(each, index) in needs" :key="each.id"><template v-if="index > 0">, </template><button class="inline-link" @click="emit('open', each.id)">{{ each.name }}</button></template></dd><dd v-else>Nothing else</dd></div>
          <div v-if="'hub' in feature"><dt>In the Hub</dt><dd>Type <kbd>{{ feature.name.toLowerCase() }}</kbd></dd></div>
          <div v-if="versions.length"><dt>Version</dt><dd>Updated in GWonMac {{ versions[0]!.version }}</dd></div>
        </dl>
        <div class="fact-links">
          <button class="link-row" @click="emit('external', 'bugReport')"><Bug aria-hidden="true" />Report a problem</button>
          <button class="link-row" @click="emit('external', 'github')"><Code aria-hidden="true" />View the source on GitHub</button>
        </div>
      </aside>
    </div>
  </article>
</template>

<style scoped>
.feature-page { width: 100%; max-width: 1116px; margin: 0 auto; display: flex; flex-direction: column; gap: 28px; }
.back { align-self: flex-start; min-height: 32px; margin: -12px 0 0 -10px; padding: 6px 10px; border-radius: var(--radius-sm); font-size: var(--fs-sm); }
.back svg { width: 16px; height: 16px; }
.feature-head { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 22px; margin-top: -8px; }
.head-copy { flex: 1 1 360px; min-width: 0; display: grid; gap: 6px; }
.head-copy h1 { margin: 0; font-size: var(--fs-page); line-height: 1.1; }
.head-copy p { margin: 0; }
.head-summary { color: var(--text-soft); font-size: 15px; }
.head-meta { font-size: var(--fs-sm); }
.head-status { display: flex; flex-wrap: wrap; align-items: center; gap: 0 6px; font-size: var(--fs-sm); }
.head-status svg { width: 16px; height: 16px; }
.on { color: var(--success); font-weight: 600; }
.muted { color: var(--muted); }
.warning { color: var(--warning); }
.head-action .primary, .head-action .secondary { min-width: 132px; }
.inline-link { display: inline; padding: 0; color: var(--gold-text); font: inherit; text-decoration: underline 1px var(--gold-line); text-underline-offset: 3px; }
.inline-link:hover { text-decoration-color: var(--gold); }

.feature-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 48px; align-items: start; }
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

.feature-main section.options { gap: 0; }
.save-note { margin: 4px 0 6px; font-size: var(--fs-sm); }
.save-note.failed { color: var(--danger-text); }
.row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.row-label { display: grid; gap: 3px; font-size: var(--fs-md); }
.row-label small { color: var(--muted); font-size: var(--fs-sm); line-height: 1.45; }
.version { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--line); }
.version > span { display: grid; gap: 4px; align-content: start; font-size: var(--fs-md); }
.version small { color: var(--gold-text); font-size: var(--fs-xs); }
.version ul { margin: 0; padding-left: 18px; color: var(--text-soft); font-size: var(--fs-md); line-height: 1.6; }

.facts { position: sticky; top: 0; display: flex; flex-direction: column; gap: 16px; }
.facts dl { margin: 0; padding: 4px 20px; border: 1px solid var(--line); border-radius: var(--radius-lg); background: var(--surface-solid); }
.facts dl > div { display: grid; gap: 4px; padding: 13px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-md); }
.facts dl > div:last-child { border-bottom: 0; }
.facts dt { color: var(--muted); font-size: var(--fs-xs); }
.facts dd { margin: 0; }
.facts kbd { display: inline-grid; place-items: center; min-width: 24px; height: 22px; padding: 0 6px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--control); font: inherit; font-size: var(--fs-xs); }
.fact-links { display: grid; padding: 4px 20px; }
.link-row { display: flex; align-items: center; gap: 8px; padding: 9px 0; color: var(--text-soft); font-size: var(--fs-md); text-align: left; }
.link-row:hover { color: var(--text); }
.link-row svg { width: 16px; height: 16px; color: var(--muted); }

@media (max-width: 980px) {
  .feature-layout { grid-template-columns: minmax(0, 1fr); gap: 32px; }
  .facts { position: static; }
}
</style>
