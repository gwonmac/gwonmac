<script setup lang="ts">
/**
 * The Features catalog: the plain-game strip, the cards in Large or Compact size grouped by what
 * the player is doing, and each Feature's page. The launcher draws it as its Features tab; the Hub draws it
 * as the Features section of its Settings page (`embedded`). Statuses come from resolve through
 * ../features.ts; switches and options write through the host's bridge, or, in a browser preview,
 * change the shown fixture. Every write goes through one save status (../save-status.ts): the
 * host's when it passes `performSave`, else the tab's own, drawn at the bottom of the page.
 */
import { computed, nextTick, ref, watch } from "vue";
import { AlertCircle, Check, LayoutGrid, List, Search } from "lucide-vue-next";
import { featureSettingText, type FeatureId } from "@shared/feature-contracts";
import type { LauncherExternalLink, LauncherFeedback, LauncherSnapshot } from "@shared/launcher-contracts";
import type { SettingsTarget } from "@shared/settings-catalogue";
import type { InGameNative, InGamePatch, InGameSettings } from "../settings-host";
import {
  CARD_FEATURES,
  cardsAt,
  REGION_WORDS,
  badgeOf,
  changelogOf,
  featureStatus,
  groupCards,
  FEATURE_GROUPS,
  presenceTag,
  launcherFeatureState,
  type CardFeature,
  type CardSize,
  type FeatureFilter,
  type SwitchChange,
} from "../features";
import { runsWith, showsReason, switchOf } from "@shared/feature-status";
import { fixtureFacts } from "../fixtures";
import { revealSetting } from "../reveal-setting";
import { useSaveStatus, type PerformSave } from "../save-status";
import FeatureArt from "./FeatureArt.vue";
import FeaturePage from "./FeaturePage.vue";
import FeatureSwitch from "./FeatureSwitch.vue";
import SaveStatus from "./SaveStatus.vue";

/** What the catalog reads: the launcher's snapshot, or the Hub's bounded copy (app/shared/hub-settings.ts). */
export type FeaturesSnapshot = Pick<LauncherSnapshot, "tools" | "features" | "shortcuts"> & Readonly<{
  settings: InGameSettings;
  appVersion: string;
  /** A game window is open, so the launcher cannot restart. Always true in the Hub. */
  gamesOpen: boolean;
}>;
/** Browser preview only: what a change would have saved. */
export type FeaturesFixtureChange = Partial<Pick<LauncherSnapshot, "tools" | "features">> & Readonly<{ settings?: InGamePatch }>;

const props = withDefaults(defineProps<{
  snapshot: FeaturesSnapshot;
  native: InGameNative | undefined;
  /** Where to open; a new object opens it again, even at the same control. */
  target?: SettingsTarget | null;
  /** Saves an option; absent: through `native`, or the fixture. */
  save?: ((patch: InGamePatch) => Promise<void>) | undefined;
  /** Wraps every bridge write, so the host's status line can report it; absent: the tab reports its own. */
  performSave?: PerformSave | undefined;
  /** Drawn inside the Hub's Settings page. */
  embedded?: boolean;
  /** Sends a Feature page's feedback; absent (the Hub): the page has no Feedback tab. */
  sendFeedback?: ((feedback: LauncherFeedback) => Promise<void>) | undefined;
}>(), { target: null, save: undefined, performSave: undefined, embedded: false, sendFeedback: undefined });
const feature = defineModel<FeatureId | null>("feature", { default: null });
const emit = defineEmits<{
  /** Browser preview only: the change, for the host to show. */
  fixture: [change: FeaturesFixtureChange];
  settings: [target: SettingsTarget];
  external: [kind: LauncherExternalLink];
  url: [url: string];
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
/** Restart launcher is not a save: its failure has a line of its own. */
const restartError = ref("");
const page = ref<HTMLElement | null>(null);
const pageView = ref<InstanceType<typeof FeaturePage> | null>(null);
const searchField = ref<HTMLInputElement | null>(null);
/** The tab's own save status, when the host has none. Its controls show the saved value, so it has no Revert. */
const ownStatus = props.performSave ? null : useSaveStatus({ keepsChange: false, root: page });
const performSave: PerformSave = props.performSave ?? ownStatus!.performSave;
function identify(event: Event) { ownStatus?.identify(event); }

const tools = computed(() => props.snapshot.tools);
const state = computed(() => launcherFeatureState(props.snapshot.features));
/** The stage this build shows (app/shared/release.ts): a Feature or option with a later one is not in this release. */
const stage = computed(() => props.snapshot.features.stage);
const cards = computed(() => cardsAt(stage.value));
const statuses = computed(() => new Map(CARD_FEATURES.map((each) => [each.id, featureStatus(each, state.value, tools.value)])));
const statusOf = (each: CardFeature) => statuses.value.get(each.id)!;
const badges = computed(() => new Map(CARD_FEATURES.map((each) => [each.id, badgeOf(changelogOf(each), props.snapshot.appVersion)])));
const groups = computed(() => groupCards(filter.value, query.value, (each) => statusOf(each).checked, stage.value));
const onCount = computed(() => cards.value.filter((each) => statusOf(each).checked).length);
const filters = computed(() => [
  { id: "all", name: "All" },
  { id: "on", name: `On (${onCount.value})` },
  ...FEATURE_GROUPS,
]);
const shown = computed(() => cards.value.find((each) => each.id === feature.value) ?? null);

/** The launch mode's words, from its manifest; its switch is inverted (on while `gwonmacTools` is off). */
const PLAIN_GAME = featureSettingText("gwonmacTools");
const plain = computed(() => !tools.value.configured);
/** Turned off the plain game in this launcher session: Features load after a launcher restart. */
const waitingForRestart = computed(() => tools.value.configured && !tools.value.loaded);
const gamesOpen = computed(() => props.snapshot.gamesOpen);
/** Only the launcher can restart itself; a browser preview pretends it can. */
const canRestart = computed(() => !props.native || props.native.tools.restartToApply !== undefined);
const plainStatus = computed(() => plain.value
  ? "Every Feature is off. Turn off the plain game to get each one back as it was."
  : waitingForRestart.value
    ? "Your choices are saved. Restart the launcher to load Features."
    : "Features are loaded. Each switch below works at once in supported game areas.");


/** One bridge write, reported by the save status. */
async function write(action: () => Promise<unknown>) {
  await performSave(action);
}
/** Moves saved switches through the bridge, or changes the preview's fixture. */
async function apply(changes: readonly SwitchChange[]) {
  const native = props.native;
  if (native) {
    for (const change of changes) await write(() => native.tools.setFeature(change));
    return;
  }
  const features = { ...props.snapshot.tools.features };
  for (const { tool, enabled } of changes) features[tool] = { enabled };
  showFixture({ ...props.snapshot.tools, features });
}
/** Browser preview only: the fixture with these switches, and the facts main would send for them. */
function showFixture(tools: LauncherSnapshot["tools"]) {
  emit("fixture", { tools, features: fixtureFacts(tools, props.snapshot.features.features) });
}
async function attempt(action: () => Promise<unknown>) {
  try { await action(); } catch { /* The save status reports it and offers Retry. */ }
}

async function toggle(each: CardFeature, on: boolean) {
  // A switchless Feature has nothing of its own to turn off: its switch is the one it runs with.
  // A Feature that needs another reads "Needs X" and offers "Turn on X" (resolve's reason).
  if (statusOf(each).locked || (!on && runsWith(each))) return;
  await attempt(() => apply([{ tool: switchOf(each), enabled: on }]));
}

async function setPlain(on: boolean) {
  await attempt(async () => {
    const native = props.native;
    if (native) { await write(() => native.tools.setMasterEnabled(!on)); return; }
    const configured = !on;
    showFixture({ ...props.snapshot.tools, configured, restartRequired: configured !== props.snapshot.tools.loaded });
  });
}
async function restart() {
  restartError.value = "";
  try { await props.native?.tools.restartToApply?.(); }
  catch { restartError.value = "The launcher could not restart. Try again."; }
}
async function saveSettings(patch: InGamePatch) {
  if (props.save) await props.save(patch);
  else if (props.native) { const native = props.native; await write(() => native.settings.update(patch)); }
  else emit("fixture", { settings: patch });
}

/** Opens a Feature page and puts the keyboard on its title; back returns it to the card. */
let returnTo: FeatureId | null = null;
async function open(id: FeatureId) {
  returnTo = feature.value ?? id;
  feature.value = id;
}
watch(feature, async (next, previous) => {
  ownStatus?.leave();
  await nextTick();
  if (page.value) page.value.scrollTop = 0;
  if (next) page.value?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  else if (previous) page.value?.querySelector<HTMLElement>(`[data-feature="${returnTo ?? previous}"] .card-link`)?.focus();
});

/** Opens the target's Feature page (or the catalog) and puts its control in view. */
async function reveal(target: SettingsTarget) {
  if ((target.feature ?? null) !== feature.value) {
    returnTo = target.feature ?? feature.value;
    feature.value = target.feature ?? null;
  }
  await nextTick();
  // An option lives on the page's Settings tab; the header switch is on every tab.
  if (target.control && !target.control.startsWith("tool:")) pageView.value?.show("settings");
  await nextTick();
  await nextTick();
  if (page.value && target.control) revealSetting(page.value, target.control, true);
}
watch(() => props.target, (target) => { if (target) void reveal(target); }, { immediate: true });

function clearSearch() {
  query.value = "";
  filter.value = "all";
  searchField.value?.focus();
}
function onSearchKey(event: KeyboardEvent) {
  if (event.key === "Escape" && query.value) { event.preventDefault(); query.value = ""; }
}
</script>

<template>
  <section ref="page" class="features-page" :class="{ page: !embedded }" @change.capture="identify" @click.capture="identify">
    <FeaturePage
      v-if="shown"
      :feature="shown"
      :status="statusOf(shown)"
      :settings="snapshot.settings"
      :shortcuts="snapshot.shortcuts"
      :api="native?.tools"
      :save="saveSettings"
      :perform-save="performSave"
      :app-version="snapshot.appVersion"
      :stage="stage"
      :embedded="embedded"
      :send-feedback="sendFeedback"
      ref="pageView"
      @back="feature = null"
      @toggle="toggle(shown, $event)"
      @turn-on="toggle($event, true)"
      @open="open"
      @settings="emit('settings', $event)"
      @external="emit('external', $event)"
      @url="emit('url', $event)"
      @link="emit('link', $event)"
    />
    <div v-else class="catalog">
      <div class="page-head">
        <div>
          <h1>Features</h1>
          <p>Optional additions to the official game. Each one runs only on Guild Wars builds that GWonMac has checked.</p>
        </div>
        <label class="catalog-search">
          <Search aria-hidden="true" />
          <span class="visually-hidden">Search Features</span>
          <input ref="searchField" v-model="query" class="search-field" type="search" placeholder="Search Features" @keydown="onSearchKey" />
        </label>
      </div>

      <div class="plain-strip" :class="{ warn: plain || waitingForRestart }" data-setting="gwonmacTools">
        <span class="strip-icon" aria-hidden="true"><AlertCircle v-if="plain || waitingForRestart" /><Check v-else /></span>
        <span class="strip-copy">
          <strong id="plain-label">{{ PLAIN_GAME.label }}</strong>
          <small id="plain-help">{{ PLAIN_GAME.help }}</small>
          <small class="strip-status" role="status">{{ plainStatus }}</small>
          <small v-if="waitingForRestart && gamesOpen && canRestart">Close every game window before restarting the launcher.</small>
        </span>
        <button v-if="waitingForRestart && canRestart" class="primary small" :disabled="gamesOpen" @click="restart">Restart launcher</button>
        <FeatureSwitch :checked="plain" :label="PLAIN_GAME.label" describedby="plain-help" @change="setPlain" />
      </div>

      <div class="catalog-tools">
        <div class="filters" role="group" aria-label="Show Features">
          <template v-for="(each, index) in filters" :key="each.id">
            <span v-if="index === 2" class="filter-divider" aria-hidden="true"></span>
            <button class="pill" :class="{ selected: filter === each.id }" :aria-pressed="filter === each.id" @click="filter = each.id">{{ each.name }}</button>
          </template>
        </div>
        <span class="count">{{ cards.length }} Features</span>
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
                <span v-if="!runsWith(each) && presenceTag(each, snapshot.shortcuts)" class="chip">{{ presenceTag(each, snapshot.shortcuts) }}</span>
                <span class="chip">{{ REGION_WORDS[each.region] }}</span>
                <span v-if="runsWith(each)" class="runs-with">Part of {{ runsWith(each)!.name }}</span>
                <FeatureSwitch v-else :checked="statusOf(each).checked" :label="each.name" :locked="statusOf(each).locked" :describedby="showsReason(statusOf(each)) ? `reason-${each.id}` : undefined" @change="toggle(each, $event)" />
              </div>
            </template>
            <template v-else>
              <FeatureArt :feature="each" variant="tile" />
              <span class="tile-copy">
                <strong><button class="card-link" @click="open(each.id)">{{ each.name }}</button><span v-if="badges.get(each.id)" class="dot" :title="badges.get(each.id) ?? undefined"></span><span v-if="badges.get(each.id)" class="visually-hidden">{{ badges.get(each.id) }}</span></strong>
                <small :id="`reason-${each.id}`" :class="showsReason(statusOf(each)) ? statusOf(each).tone : 'muted'">{{ showsReason(statusOf(each)) ? statusOf(each).text : each.summary }}</small>
              </span>
              <span v-if="runsWith(each)" class="runs-with">Part of {{ runsWith(each)!.name }}</span>
              <FeatureSwitch v-else :checked="statusOf(each).checked" :label="each.name" :locked="statusOf(each).locked" :describedby="showsReason(statusOf(each)) ? `reason-${each.id}` : undefined" @change="toggle(each, $event)" />
            </template>
          </article>
        </div>
      </section>

      <div v-if="groups.length === 0" class="no-results">
        <h2>{{ query.trim() ? `No Feature matches “${query.trim()}”` : "No Feature is on yet" }}</h2>
        <p>{{ query.trim() ? "Try another word, or look through all Features." : "Turn on a Feature from All to see it here." }}</p>
        <button class="secondary" @click="clearSearch">Show all Features</button>
      </div>

      <p v-if="!embedded" class="suggest">Missing something you used on Windows? <button class="text-link" @click="emit('external', 'featureRequest')">Suggest a Feature</button></p>
    </div>

    <p v-if="restartError" class="inline-message features-alert" role="alert">{{ restartError }}</p>
    <SaveStatus v-if="ownStatus" class="features-status" :status="ownStatus" :idle-note="false" />
  </section>
</template>

<style scoped>
.features-page { display: flex; flex-direction: column; }
.catalog { width: 100%; max-width: 1176px; margin: 0 auto; display: flex; flex-direction: column; gap: 24px; }
/* The Hub's Settings page has no launcher page styles, so the head carries its own. */
.catalog .page-head { min-width: 0; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 24px; margin-bottom: 0; }
.catalog .page-head h1 { margin: 0 0 6px; font-size: var(--fs-page); line-height: 1.1; }
.catalog .page-head p { margin: 0; max-width: 620px; font-size: var(--fs-md); text-wrap: pretty; }
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
.count { color: var(--muted); font-size: var(--fs-xs); }
/* When the filters take the whole row, the view controls wrap to the right edge together. */
.count { margin-left: auto; }
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
/* A pressed button scales, and a transform or filter would shrink the cover to the name, so the release misses it. */
.card-link:active { transform: none; filter: none; }
.card-link:focus-visible { outline: none; }
.card { display: flex; flex-direction: column; overflow: hidden; border-radius: var(--radius-lg); background: var(--surface-solid); }
.badge { position: absolute; top: 10px; left: 10px; padding: 3px 8px; border-radius: var(--radius-pill); color: var(--on-gold); background: var(--gold); font-size: var(--fs-2xs); font-weight: 700; }
.badge.updated { color: var(--gold-text); background: var(--badge-ground); border: 1px solid var(--gold-line); }
.card-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding: 14px 16px 4px; }
.card-body h3 { margin: 0; font-size: 15px; font-weight: 600; }
.summary { display: -webkit-box; margin: 0; overflow: hidden; color: var(--muted); font-size: var(--fs-sm); line-height: 1.45; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.runs-with { color: var(--muted); font-size: var(--fs-xs); white-space: nowrap; }
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
/* The tab's save status: a bar at the end of the page. Only a failure, which needs Retry, is pinned
   to the bottom; a pinned "Saved" note would cover the last controls on the page. */
.features-page .features-status { margin: 16px 0 0; padding: 8px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--surface-solid); font-size: var(--fs-sm); }
.features-page .features-status.save-failed { position: sticky; bottom: 0; background: linear-gradient(var(--danger-tint), var(--danger-tint)), var(--surface-solid); }
.features-page .features-status.save-idle { margin: 0; padding: 0; border: 0; }
@media (prefers-reduced-motion: reduce) {
  .card, .tile { transition: none; }
}
@media (max-width: 760px) {
  .count { display: none; }
}
</style>
