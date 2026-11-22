<script setup lang="ts">
/**
 * The Features tab: the plain-game strip, the catalog in Large or Compact cards grouped by Kind
 * or Purpose, and each Feature's page. Statuses come from resolve through ../features.ts; the
 * switches write through the launcher bridge, or, in a browser preview, change the shown fixture.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { AlertCircle, Check, LayoutGrid, List, Search, X } from "lucide-vue-next";
import type { FeatureId } from "@shared/feature-contracts";
import type { LauncherExternalLink, LauncherNativeApi, LauncherSettingsPatch, LauncherSnapshot } from "@shared/launcher-contracts";
import type { SettingsTarget } from "@shared/settings-catalogue";
import {
  CARD_FEATURES,
  REGION_WORDS,
  alsoOnNotice,
  badgeOf,
  cardFeature,
  changelogOf,
  featureStatus,
  groupCards,
  groupsFor,
  launcherFeatureState,
  showsReason,
  switchOf,
  turnOnChanges,
  type CardFeature,
  type CardSize,
  type FeatureChecks,
  type FeatureFilter,
  type GroupBy,
  type SwitchChange,
} from "../features";
import FeatureArt from "./FeatureArt.vue";
import FeaturePage from "./FeaturePage.vue";
import FeatureSwitch from "./FeatureSwitch.vue";

const props = defineProps<{
  snapshot: LauncherSnapshot;
  native: LauncherNativeApi | undefined;
  /** The build checks of a game session; null in the launcher until plan step 7.1. */
  checks: FeatureChecks;
}>();
const feature = defineModel<FeatureId | null>("feature", { default: null });
const emit = defineEmits<{
  /** Browser preview only: the snapshot with a change applied. */
  fixture: [snapshot: LauncherSnapshot];
  settings: [target: SettingsTarget];
  external: [kind: LauncherExternalLink];
  link: [actionId: string];
}>();

const SIZE_KEY = "gwonmac.featuresCardSize";
/** The card size is this Mac's convenience, so browser storage keeps it; losing it shows Large again. */
function rememberedSize(): CardSize {
  try { return localStorage.getItem(SIZE_KEY) === "compact" ? "compact" : "large"; } catch { return "large"; }
}
const size = ref<CardSize>(rememberedSize());
watch(size, (next) => { try { localStorage.setItem(SIZE_KEY, next); } catch { /* the choice lasts this session */ } });

const query = ref("");
const filter = ref<FeatureFilter>("all");
const groupBy = ref<GroupBy>("kind");
const message = ref("");
const notice = ref<{ text: string; feature: FeatureId; undo: readonly SwitchChange[] } | null>(null);
const page = ref<HTMLElement | null>(null);
const searchField = ref<HTMLInputElement | null>(null);

const tools = computed(() => props.snapshot.tools);
const state = computed(() => launcherFeatureState(tools.value, props.checks));
const statuses = computed(() => new Map(CARD_FEATURES.map((each) => [each.id, featureStatus(each, state.value, tools.value)])));
const statusOf = (each: CardFeature) => statuses.value.get(each.id)!;
const badges = computed(() => new Map(CARD_FEATURES.map((each) => [each.id, badgeOf(changelogOf(each), props.snapshot.appUpdate.currentVersion)])));
const groups = computed(() => groupCards(groupBy.value, filter.value, query.value, (each) => statusOf(each).checked));
const onCount = computed(() => CARD_FEATURES.filter((each) => statusOf(each).checked).length);
const filters = computed(() => [
  { id: "all", name: "All" },
  { id: "on", name: `On (${onCount.value})` },
  ...groupsFor(groupBy.value),
]);
const shown = computed(() => (feature.value ? cardFeature(feature.value) : undefined) ?? null);

const plain = computed(() => !tools.value.configured);
/** Turned off the plain game in this launcher session: Features load after a launcher restart. */
const waitingForRestart = computed(() => tools.value.configured && !tools.value.loaded);
const gamesOpen = computed(() => props.snapshot.profiles.some((profile) => profile.state !== "ready" && profile.state !== "failed"));
const plainStatus = computed(() => plain.value
  ? "Every Feature is off. Turn off the plain game to get each one back as it was."
  : waitingForRestart.value
    ? "Your choices are saved. Restart the launcher to load Features."
    : "Features are loaded. Each switch below works at once in supported game areas.");


/** Moves saved switches through the bridge, or changes the preview's fixture. */
async function apply(changes: readonly SwitchChange[]) {
  if (props.native) {
    for (const change of changes) await props.native.tools.setFeature(change);
    return;
  }
  const features = { ...props.snapshot.tools.features };
  for (const { tool, enabled } of changes) features[tool] = { enabled };
  emit("fixture", { ...props.snapshot, tools: { ...props.snapshot.tools, features } });
}
async function attempt(action: () => Promise<unknown>) {
  message.value = "";
  try { await action(); } catch { message.value = "This change could not be saved. Try again."; }
}

async function toggle(each: CardFeature, on: boolean) {
  if (statusOf(each).locked) return;
  notice.value = null;
  if (!on) { await attempt(() => apply([{ tool: switchOf(each), enabled: false }])); return; }
  const { changes, alsoOn } = turnOnChanges(each, tools.value);
  await attempt(async () => {
    await apply(changes);
    if (alsoOn.length > 0) notice.value = { text: alsoOnNotice(each, alsoOn), feature: each.id, undo: changes.map(({ tool }) => ({ tool, enabled: false })) };
  });
}
async function undo() {
  if (!notice.value) return;
  const { feature: id, undo: changes } = notice.value;
  notice.value = null;
  await attempt(() => apply(changes));
  await focusSwitch(id);
}
async function dismiss() {
  if (!notice.value) return;
  const id = notice.value.feature;
  notice.value = null;
  await focusSwitch(id);
}
/** The toast leaves with its button: the keyboard goes back to the switch the notice was about. */
async function focusSwitch(id: FeatureId) {
  await nextTick();
  const target = page.value?.querySelector<HTMLElement>(`[data-feature="${id}"] [role="switch"]`) ?? page.value?.querySelector<HTMLElement>(".head-action button");
  target?.focus();
}

async function setPlain(on: boolean) {
  notice.value = null;
  await attempt(async () => {
    if (props.native) { await props.native.tools.setMasterEnabled(!on); return; }
    const configured = !on;
    emit("fixture", { ...props.snapshot, tools: { ...props.snapshot.tools, configured, restartRequired: configured !== props.snapshot.tools.loaded } });
  });
}
async function restart() {
  await attempt(async () => { await props.native?.tools.restartToApply(); });
}
async function saveSettings(patch: LauncherSettingsPatch) {
  if (props.native) await props.native.settings.update(patch);
  else emit("fixture", { ...props.snapshot, settings: { ...props.snapshot.settings, ...patch } });
}

/** Opens a Feature page and puts the keyboard on its title; back returns it to the card. */
let returnTo: FeatureId | null = null;
async function open(id: FeatureId) {
  returnTo = feature.value ?? id;
  feature.value = id;
}
watch(feature, async (next, previous) => {
  await nextTick();
  if (page.value) page.value.scrollTop = 0;
  if (next) page.value?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  else if (previous) page.value?.querySelector<HTMLElement>(`[data-feature="${returnTo ?? previous}"] .card-link`)?.focus();
});

function clearSearch() {
  query.value = "";
  filter.value = "all";
  searchField.value?.focus();
}
function onSearchKey(event: KeyboardEvent) {
  if (event.key === "Escape" && query.value) { event.preventDefault(); query.value = ""; }
}
function pickGroup(next: GroupBy) {
  if (filter.value !== "all" && filter.value !== "on") filter.value = "all";
  groupBy.value = next;
}
onBeforeUnmount(() => { notice.value = null; });
</script>

<template>
  <section ref="page" class="page features-page">
    <FeaturePage
      v-if="shown"
      :feature="shown"
      :status="statusOf(shown)"
      :snapshot="snapshot"
      :native="native"
      :save="saveSettings"
      @back="feature = null"
      @toggle="toggle(shown, $event)"
      @turn-on="toggle($event, true)"
      @open="open"
      @settings="emit('settings', $event)"
      @external="emit('external', $event)"
      @link="emit('link', $event)"
    />
    <div v-else class="catalog">
      <div class="page-head">
        <div>
          <h1>Features</h1>
          <p>Optional additions to the official game, made by the GWonMac project. Each one runs only on Guild Wars builds that GWonMac has checked.</p>
        </div>
        <label class="catalog-search">
          <Search aria-hidden="true" />
          <span class="visually-hidden">Search Features</span>
          <input ref="searchField" v-model="query" class="search-field" type="search" placeholder="Search Features" @keydown="onSearchKey" />
        </label>
      </div>

      <div class="plain-strip" :class="{ warn: plain || waitingForRestart }">
        <span class="strip-icon" aria-hidden="true"><AlertCircle v-if="plain || waitingForRestart" /><Check v-else /></span>
        <span class="strip-copy">
          <strong id="plain-label">Play the plain game</strong>
          <small id="plain-help">Turns off every Feature. Your Feature choices stay saved.</small>
          <small class="strip-status" role="status">{{ plainStatus }}</small>
          <small v-if="waitingForRestart && gamesOpen">Close every game window before restarting the launcher.</small>
        </span>
        <button v-if="waitingForRestart" class="primary small" :disabled="gamesOpen" @click="restart">Restart launcher</button>
        <FeatureSwitch :checked="plain" label="Play the plain game" describedby="plain-help" @change="setPlain" />
      </div>

      <div class="catalog-tools">
        <div class="filters" role="group" aria-label="Show Features">
          <template v-for="(each, index) in filters" :key="each.id">
            <span v-if="index === 2" class="filter-divider" aria-hidden="true"></span>
            <button class="pill" :class="{ selected: filter === each.id }" :aria-pressed="filter === each.id" @click="filter = each.id">{{ each.name }}</button>
          </template>
        </div>
        <span class="count">{{ CARD_FEATURES.length }} Features</span>
        <span id="group-label" class="group-label">Group by</span>
        <div class="segment" role="group" aria-labelledby="group-label">
          <button :class="{ selected: groupBy === 'kind' }" :aria-pressed="groupBy === 'kind'" @click="pickGroup('kind')">Kind</button>
          <button :class="{ selected: groupBy === 'purpose' }" :aria-pressed="groupBy === 'purpose'" @click="pickGroup('purpose')">Purpose</button>
        </div>
        <div class="segment" role="group" aria-label="Card size">
          <button class="icon-only" :class="{ selected: size === 'large' }" :aria-pressed="size === 'large'" aria-label="Large cards" title="Large cards" @click="size = 'large'"><LayoutGrid aria-hidden="true" /></button>
          <button class="icon-only" :class="{ selected: size === 'compact' }" :aria-pressed="size === 'compact'" aria-label="Compact list" title="Compact list" @click="size = 'compact'"><List aria-hidden="true" /></button>
        </div>
      </div>

      <section v-for="group in groups" :key="group.id" class="feature-group" :aria-labelledby="`group-${group.id}`">
        <h2 :id="`group-${group.id}`">{{ group.name }} <span>{{ group.features.length }}</span></h2>
        <div :class="size === 'large' ? 'card-grid' : 'tile-grid'">
          <article
            v-for="each in group.features"
            :key="each.id"
            :data-feature="each.id"
            :class="size === 'large' ? 'card' : 'tile'"
          >
            <template v-if="size === 'large'">
              <FeatureArt :feature="each" variant="picture" />
              <span v-if="badges.get(each.id)" class="badge" :class="{ updated: badges.get(each.id) === 'Updated' }">{{ badges.get(each.id) }}</span>
              <div class="card-body">
                <h3><button class="card-link" @click="open(each.id)">{{ each.name }}</button></h3>
                <p class="summary">{{ each.summary }}</p>
                <p v-if="showsReason(statusOf(each))" :id="`reason-${each.id}`" class="reason" :class="statusOf(each).tone">{{ statusOf(each).text }}</p>
              </div>
              <div class="card-foot">
                <span class="chip">{{ REGION_WORDS[each.region] }}</span>
                <FeatureSwitch :checked="statusOf(each).checked" :label="each.name" :locked="statusOf(each).locked" :describedby="showsReason(statusOf(each)) ? `reason-${each.id}` : undefined" @change="toggle(each, $event)" />
              </div>
            </template>
            <template v-else>
              <FeatureArt :feature="each" variant="tile" />
              <span class="tile-copy">
                <strong><button class="card-link" @click="open(each.id)">{{ each.name }}</button><span v-if="badges.get(each.id)" class="dot" :title="badges.get(each.id) ?? undefined"></span><span v-if="badges.get(each.id)" class="visually-hidden">{{ badges.get(each.id) }}</span></strong>
                <small :id="`reason-${each.id}`" :class="showsReason(statusOf(each)) ? statusOf(each).tone : 'muted'">{{ showsReason(statusOf(each)) ? statusOf(each).text : each.summary }}</small>
              </span>
              <FeatureSwitch :checked="statusOf(each).checked" :label="each.name" :locked="statusOf(each).locked" :describedby="showsReason(statusOf(each)) ? `reason-${each.id}` : undefined" @change="toggle(each, $event)" />
            </template>
          </article>
        </div>
      </section>

      <div v-if="groups.length === 0" class="no-results">
        <h2>{{ query.trim() ? `No Feature matches “${query.trim()}”` : "No Feature is on yet" }}</h2>
        <p>{{ query.trim() ? "Try another word, or look through all Features." : "Turn on a Feature from All to see it here." }}</p>
        <button class="secondary" @click="clearSearch">Show all Features</button>
      </div>

      <p class="suggest">Missing something you used on Windows? <button class="text-link" @click="emit('external', 'featureRequest')">Suggest a Feature</button></p>
    </div>

    <p v-if="message" class="inline-message features-alert" role="alert">{{ message }}</p>
    <div v-if="notice" class="toast" role="status">
      <Check />
      <div><span>{{ notice.text }}</span></div>
      <span class="toast-actions"><button class="secondary small" @click="undo">Undo</button><button class="icon-button" aria-label="Dismiss" @click="dismiss"><X /></button></span>
    </div>
  </section>
</template>

<style scoped>
.features-page { display: flex; flex-direction: column; }
.catalog { width: 100%; max-width: 1176px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
.catalog .page-head { margin-bottom: 0; flex-wrap: wrap; }
.catalog-search { position: relative; flex: 0 1 280px; display: block; }
.catalog-search svg { position: absolute; left: 11px; top: 50%; width: 16px; height: 16px; color: var(--muted); transform: translateY(-50%); pointer-events: none; }
/* Must outweigh style.css's field rule (four :not() tests), whose padding would cover the icon. */
.catalog .catalog-search input.search-field[type="search"] { height: 36px; padding: 0 12px 0 34px; font-size: var(--fs-sm); }

.plain-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 12px 16px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface-row); }
.plain-strip.warn { border-color: var(--gold-line); background: var(--warning-tint); }
.strip-icon { display: grid; place-items: center; width: 28px; height: 28px; border-radius: var(--radius-pill); color: var(--success); background: var(--success-tint); }
.strip-icon svg { width: 16px; height: 16px; stroke-width: 2.4; }
.warn .strip-icon { color: var(--warning); background: var(--warning-tint); }
.strip-copy { flex: 1 1 320px; display: grid; gap: 2px; }
.strip-copy strong { font-size: var(--fs-md); font-weight: 600; }
.strip-copy small { color: var(--muted); font-size: var(--fs-sm); }
.strip-copy .strip-status { color: var(--text-soft); }
.warn .strip-copy .strip-status { color: var(--warning); }

.catalog-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding-bottom: 13px; border-bottom: 1px solid var(--line); }
.filters { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-right: auto; }
.filter-divider { width: 1px; height: 16px; margin: 0 6px; background: var(--line); }
.pill { padding: 6px 12px; border: 1px solid transparent; border-radius: var(--radius-pill); color: var(--muted); font-size: var(--fs-xs); }
.pill:hover { color: var(--text); }
.pill.selected { color: var(--text); background: var(--control); border-color: var(--line); }
.count, .group-label { color: var(--muted); font-size: var(--fs-xs); }
/* When the filters take the whole row, the view controls wrap to the right edge together. */
.count { margin-left: auto; }
.group-label { margin-right: -10px; }
.segment { display: flex; gap: 2px; padding: 2px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--control); }
.segment button { min-height: 26px; padding: 0 10px; border-radius: var(--radius-sm); color: var(--muted); font-size: var(--fs-xs); }
.segment button.icon-only { display: grid; place-items: center; width: 30px; padding: 0; }
.segment button svg { width: 16px; height: 16px; }
.segment button:hover { color: var(--text); }
.segment button.selected { color: var(--text); background: var(--surface-selected); }

.feature-group { display: flex; flex-direction: column; gap: 12px; }
.feature-group h2 { margin: 8px 0 0; font-size: var(--fs-body); font-weight: 600; }
.feature-group h2 span { margin-left: 6px; color: var(--muted); font-size: var(--fs-sm); font-weight: 400; }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
.tile-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }

/* The card's name is its link; its hit area covers the card, under the switch. */
.card, .tile { position: relative; min-width: 0; border: 1px solid var(--line); transition: border-color .15s ease, background-color .15s ease; }
.card:hover, .tile:hover { border-color: var(--line-strong); background: var(--surface-raised); }
.card:has(.card-link:focus-visible), .tile:has(.card-link:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
.card-link { padding: 0; color: inherit; font: inherit; text-align: left; }
.card-link::after { content: ""; position: absolute; inset: 0; }
.card-link:focus-visible { outline: none; }
.card { display: flex; flex-direction: column; overflow: hidden; border-radius: var(--radius-lg); background: var(--surface-solid); }
.badge { position: absolute; top: 10px; left: 10px; padding: 3px 8px; border-radius: var(--radius-pill); color: var(--on-gold); background: var(--gold); font-size: var(--fs-2xs); font-weight: 700; }
.badge.updated { color: var(--gold-text); background: var(--badge-ground); border: 1px solid var(--gold-line); }
.card-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding: 14px 16px 4px; }
.card-body h3 { margin: 0; font-size: 15px; font-weight: 600; }
.summary { display: -webkit-box; margin: 0; overflow: hidden; color: var(--muted); font-size: var(--fs-sm); line-height: 1.45; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.reason { margin: 2px 0 0; font-size: var(--fs-xs); line-height: 1.4; }
.reason.muted, .tile-copy small.muted { color: var(--muted); }
.reason.warning, .tile-copy small.warning { color: var(--warning); }
.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding: 8px 16px 12px; }
.tile { display: flex; align-items: center; gap: 12px; padding: 8px 10px 8px 8px; border-radius: var(--radius-md); background: var(--surface-row); }
.tile-copy { flex: 1 1 auto; min-width: 0; display: grid; gap: 2px; }
.tile-copy strong { font-size: var(--fs-md); font-weight: 600; }
.tile-copy small { overflow: hidden; font-size: var(--fs-xs); text-overflow: ellipsis; white-space: nowrap; }
.dot { display: inline-block; width: 6px; height: 6px; margin-left: 7px; border-radius: var(--radius-pill); background: var(--gold); vertical-align: middle; }

.no-results { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 32px 0; }
.no-results h2 { margin: 0; font-size: var(--fs-lg); font-weight: 600; }
.no-results p { margin: 0; font-size: var(--fs-md); }
.suggest { margin: 8px 0 0; padding-top: 16px; border-top: 1px solid var(--line); font-size: var(--fs-sm); }
.suggest .text-link { padding: 0; font-size: inherit; }
.features-alert { position: sticky; bottom: 0; margin: 16px 0 0; }
.toast .toast-actions { display: flex; align-items: center; gap: 4px; }
.toast > div { align-self: center; }
@media (prefers-reduced-motion: reduce) {
  .card, .tile { transition: none; }
}
@media (max-width: 760px) {
  .count { display: none; }
}
</style>
