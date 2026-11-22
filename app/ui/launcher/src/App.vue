<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import {
  AlertTriangle,
  Check,
  X,
} from "lucide-vue-next";
import type { LauncherDestination, LauncherFeedback, LauncherPreferencesPatch, LauncherSnapshot } from "@shared/launcher-contracts";
import type { SettingsSection, SettingsTarget } from "@shared/settings-catalogue";
import type { ProfileId } from "@shared/multiple-accounts";
import type { FeatureId } from "@shared/feature-contracts";
import { fixtureSnapshotFor } from "./fixtures";
import AccountDialogs from "./components/AccountDialogs.vue";
import AccountsView from "./components/AccountsView.vue";
import FeaturesView, { type FeaturesFixtureChange, type FeaturesSnapshot } from "./components/FeaturesView.vue";
import BaseModal from "./components/BaseModal.vue";
import LauncherHeader from "./components/LauncherHeader.vue";
import LaunchBar from "./components/LaunchBar.vue";
import HomeView from "./components/HomeView.vue";
import HelpView, { type HelpPage } from "./components/HelpView.vue";
import { releaseNotesFor } from "./release-notes";
import { parseGuideAction } from "./guide";
import NewsView from "./components/NewsView.vue";
import SettingsView from "./components/SettingsView.vue";
import type { LauncherRoute } from "./routes";

const route = ref<LauncherRoute>("home");
const snapshot = shallowRef<LauncherSnapshot>(fixtureSnapshotFor(window.location.search));
const helpPage = ref<HelpPage>();
const releaseNotes = computed(() => releaseNotesFor(snapshot.value.appUpdate.currentVersion));
/** The simple launcher is only Accounts and Settings: Home, News, Features and Help are not reachable. */
const simple = computed(() => snapshot.value.preferences.content.simple === true);
const reachable = (page: LauncherRoute): LauncherRoute =>
  simple.value && (page === "home" || page === "news" || page === "features" || page === "help") ? "accounts" : page;
const newsArticle = ref<string | null>(null);
const featurePage = ref<FeatureId | null>(null);
/** Where the Features tab opens next; each request is a new object, so the same control opens again. */
const featureTarget = ref<SettingsTarget | null>(null);
const gamesOpen = computed(() => snapshot.value.profiles.some((profile) => profile.state !== "ready" && profile.state !== "failed"));
/** What the Features tab reads from the launcher's snapshot. */
const featuresSnapshot = computed<FeaturesSnapshot>(() => ({
  tools: snapshot.value.tools, features: snapshot.value.features, shortcuts: snapshot.value.shortcuts,
  settings: snapshot.value.settings, appVersion: snapshot.value.appUpdate.currentVersion, gamesOpen: gamesOpen.value,
}));
/** The Settings page reads the in-game fields from the launcher's own snapshot. */
const settingsSnapshot = computed(() => ({ ...snapshot.value, appVersion: snapshot.value.appUpdate.currentVersion }));
/** Browser preview only: shows what a Features change would have saved. */
function showFeaturesFixture(change: FeaturesFixtureChange) {
  snapshot.value = { ...snapshot.value, ...(change.tools ? { tools: change.tools } : {}), ...(change.features ? { features: change.features } : {}), settings: { ...snapshot.value.settings, ...change.settings } };
}
watch(route, (next) => { if (next !== "help") helpPage.value = undefined; });

const WHATS_NEW_KEY = "gwonmac.whatsNewSeen";
/**
 * True once per version, on the first launch after an update. A new installation
 * (setup still pending) only records the version: it has nothing to compare with.
 * Losing this browser-storage flag costs one extra What's new page, nothing more.
 */
function firstLaunchOf(version: string): boolean {
  try {
    const seen = localStorage.getItem(WHATS_NEW_KEY);
    localStorage.setItem(WHATS_NEW_KEY, version);
    return seen !== version && !(seen === null && snapshot.value.experience.setup === "pending");
  } catch {
    return false;
  }
}
const selected = ref<ProfileId[]>([...snapshot.value.selectedProfileIds]);
const addOpen = ref(false);
const editedProfile = ref<ProfileId | null>(null);
const busy = ref(false);
const setupStep = ref<1 | 2>(1);
/** Setup's dialog cannot be dismissed, so its failure shows inside it. */
const setupError = ref("");
const updateBannerDismissed = ref(false);
const operationError = ref("");
const startupError = ref(false);
const MIGRATION_NOTICE_DURATION_MS = 8_000;
let unsubscribe: (() => void) | undefined;
let unsubscribeNavigation: (() => void) | undefined;
let migrationNoticeTimer: ReturnType<typeof setTimeout> | undefined;

const native = window.launcherNative;
let navigationRequested = false;
// Browser previews remember only navigation in this tab. Native preferences
// remain the production owner, with no browser-storage fallback.
if (!native && import.meta.env.MODE === "development") {
  const remembered = sessionStorage.getItem("launcher-preview-page");
  if (remembered === "home" || remembered === "accounts") route.value = remembered;
}
watch(route, (page) => {
  if (page !== "home" && page !== "accounts") return;
  // The simple launcher always opens on Accounts, so it leaves the remembered page for when it is off.
  if (simple.value) return;
  if (!native) {
    if (import.meta.env.MODE === "development") sessionStorage.setItem("launcher-preview-page", page);
    return;
  }
  if (snapshot.value.preferences.lastPlayPage === page) return;
  void runAction("The starting page could not be remembered.", () => native.experience.updatePreferences({ lastPlayPage: page }));
});
const synchronized = ref(!native);
onMounted(async () => {
  if (!native) return;
  unsubscribeNavigation = native.navigation.onRequest(navigateFromMain);
  // Subscribe before fetching: a window can close while the initial snapshot
  // crosses IPC. Revision ordering also refuses a late, older response.
  let receivedRevision = -1;
  const applySnapshot = (next: LauncherSnapshot) => {
    if (next.revision < receivedRevision) return;
    receivedRevision = next.revision;
    snapshot.value = next;
    selected.value = [...next.selectedProfileIds];
  };
  unsubscribe = native.state.onChange(applySnapshot);
  try {
    applySnapshot(await native.state.get());
    if (!navigationRequested) route.value = reachable(snapshot.value.preferences.lastPlayPage ?? "home");
    // The simple launcher has no News page to open the release notes on.
    if (!navigationRequested && !simple.value && releaseNotes.value && firstLaunchOf(snapshot.value.appUpdate.currentVersion)) {
      newsArticle.value = releaseNotes.value.id;
      route.value = "news";
    }
    synchronized.value = true;
  } catch {
    startupError.value = true;
  }
});
onBeforeUnmount(() => {
  unsubscribe?.();
  unsubscribeNavigation?.();
  clearTimeout(migrationNoticeTimer);
});
watch([synchronized, () => snapshot.value.experience.showMigrationNotice], ([ready, show]) => {
  clearTimeout(migrationNoticeTimer);
  migrationNoticeTimer = undefined;
  if (!ready || !show) return;
  migrationNoticeTimer = setTimeout(() => void dismissMigrationNotice(), MIGRATION_NOTICE_DURATION_MS);
}, { immediate: true });

const visibleProfiles = computed(() => snapshot.value.profiles.filter((profile) => !profile.archived));
const selectedProfiles = computed(() => visibleProfiles.value.filter((profile) => selected.value.includes(profile.id)));
const openSelected = computed(() => selectedProfiles.value.filter((profile) => profile.state === "running"));
const closedSelected = computed(() => selectedProfiles.value.filter((profile) => profile.state !== "running"));
const waiting = computed(() => selectedProfiles.value.some((profile) => profile.state === "queued"));
async function toggleProfile(id: ProfileId) {
  const next = selected.value.includes(id)
    ? selected.value.filter((value) => value !== id)
    : [...selected.value, id];
  if (next.length === 0) return;
  selected.value = next;
  await runAction("The account selection could not be saved.", () => native?.profiles.setSelection(next));
}

async function primaryAction() {
  if (busy.value || selected.value.length === 0) return;
  if (snapshot.value.readiness.state === "repair-required") {
    openSettings("game-files");
    return;
  }
  busy.value = true;
  try {
    if (waiting.value) await native?.profiles.cancelQueued([...selected.value]);
    else if (selectedProfiles.value.length === 1 && openSelected.value.length === 1) {
      await native?.profiles.show(selected.value[0]!);
    } else if (closedSelected.value.length > 0) await native?.profiles.play(closedSelected.value.map((profile) => profile.id));
  } catch {
    operationError.value = "Guild Wars could not be opened. Your account data was not changed. Try again.";
  } finally {
    busy.value = false;
  }
}

async function playProfile(id: ProfileId) {
  const profile = snapshot.value.profiles.find(candidate => candidate.id === id);
  if (!profile || profile.archived || (profile.state !== "ready" && profile.state !== "failed")) return;
  if (snapshot.value.readiness.state === "repair-required") {
    openSettings("game-files");
    return;
  }
  await runAction("This account could not be opened. Try again.", () => native?.profiles.play([id]));
}

async function cancelProfile(id: ProfileId) {
  await runAction("The waiting account could not be cancelled.", () => native?.profiles.cancelQueued([id]));
}

async function showProfile(id: ProfileId) {
  await runAction(
    "The game window could not be shown.",
    () => native?.profiles.show(id),
  );
}

/** Where Settings opens next; each request is a new object, so the same control opens again. */
const settingsTarget = ref<SettingsTarget | null>(null);
const settingsSection = ref<SettingsSection | null>(null);
function openSettings(target?: SettingsSection | SettingsTarget) {
  const place = typeof target === "string" ? { section: target } : target ? { ...target } : null;
  // Features is its own tab; the simple launcher has none, so its Settings page draws Features.
  if (place?.section === "features" && reachable("features") === "features") {
    featurePage.value = place.feature ?? null;
    featureTarget.value = place;
    route.value = "features";
    return;
  }
  settingsTarget.value = place;
  route.value = "settings";
}

function navigateFromMain(destination: LauncherDestination) {
  navigationRequested = true;
  if (typeof destination === "object") openSettings(destination);
  else if (destination === "settings") openSettings();
  else route.value = reachable(destination);
}

function retryStartup() {
  window.location.reload();
}

async function runAction(message: string, action: () => Promise<unknown> | undefined): Promise<boolean> {
  operationError.value = "";
  try {
    await action();
    return true;
  } catch {
    operationError.value = message;
    return false;
  }
}

async function completeSetup(enableTools: boolean) {
  if (native) {
    setupError.value = "";
    try { await native.experience.completeSetup({ enableTools }); }
    catch { setupError.value = "Setup could not be saved. Try again."; }
    return;
  }
  snapshot.value = { ...snapshot.value, experience: { ...snapshot.value.experience, setup: "complete" } };
}

async function dismissMigrationNotice() {
  clearTimeout(migrationNoticeTimer);
  migrationNoticeTimer = undefined;
  if (native) await runAction("The notice could not be dismissed.", () => native.experience.dismissMigrationNotice());
  else snapshot.value = { ...snapshot.value, experience: { ...snapshot.value.experience, showMigrationNotice: false } };
}

async function dismissPreferencesReset() {
  if (native) await runAction("The notice could not be dismissed.", () => native.experience.dismissPreferencesReset());
  else snapshot.value = { ...snapshot.value, experience: { ...snapshot.value.experience, preferencesReset: false } };
}

async function openExternal(kind: Parameters<NonNullable<typeof native>["external"]["open"]>[0]) {
  await runAction("The link could not be opened.", () => native?.external.open(kind));
}

async function openUrl(url: string) {
  await runAction("The link could not be opened.", () => native?.external.openUrl(url));
}

// A browser preview has no main process, so it accepts the report without sending it.
async function sendFeedback(feedback: LauncherFeedback) {
  await native?.feedback.send(feedback);
}

function navigate(next: LauncherRoute) {
  if (next === "news") newsArticle.value = null;
  if (next === "features") featurePage.value = null;
  route.value = reachable(next);
}

function readNews(id: string | null) {
  newsArticle.value = id;
  route.value = "news";
}

/** A Guide-style link from the bundled release notes. */
function followGuideLink(actionId: string) {
  const action = parseGuideAction(actionId);
  if (action?.kind === "guide") {
    helpPage.value = action.page;
    route.value = "help";
  } else if (action?.kind === "settings") openSettings(action.target);
  else if (action?.kind === "url") void openUrl(action.url);
  else if (action?.kind === "feature") {
    // The simple launcher has no Features tab: its page is on the website, built from the same README.
    if (reachable("features") !== "features") void openUrl(action.url);
    else {
      route.value = "features";
      featurePage.value = action.id;
    }
  }
}

async function openNews(id: string) {
  await runAction("The news item could not be opened.", () => native?.news.open(id));
}

async function updateContent(content: NonNullable<LauncherPreferencesPatch["content"]>) {
  const save = async () => {
    if (native) await native.experience.updatePreferences({ content });
    else snapshot.value = { ...snapshot.value, preferences: { content: { ...snapshot.value.preferences.content, ...content } } };
  };
  await runAction("Content settings could not be saved.", save);
}

</script>

<template>
  <div v-if="startupError" class="launcher-boot launcher-error" role="alert"><AlertTriangle /><h1>The launcher could not open</h1><p>Your accounts and game files were not changed.</p><button class="primary" @click="retryStartup">Try again</button></div>
  <div v-else-if="!synchronized" class="launcher-boot" role="status">Opening launcher…</div>
  <div v-else class="app-shell" :class="{ 'settings-shell': route === 'settings' }">
    <LauncherHeader :route="route" :simple="simple" @navigate="navigate" @settings="openSettings()" @external="openExternal" />


    <main :class="{ 'artwork-only': route === 'home' && !snapshot.preferences.content.news && !snapshot.preferences.content.dailies }">
      <HomeView v-if="route === 'home'" :snapshot="snapshot" @settings="openSettings('home')" @preferences="updateContent" @news="openNews" @read="readNews" />
      <NewsView v-else-if="route === 'news'" v-model:article="newsArticle" :news="snapshot.news" :release-notes="releaseNotes" @open="openNews" @link="followGuideLink" @settings="openSettings('home')" />

      <FeaturesView
        v-else-if="route === 'features'"
        v-model:feature="featurePage"
        :snapshot="featuresSnapshot"
        :native="native"
        :target="featureTarget"
        @fixture="showFeaturesFixture"
        @settings="openSettings"
        @external="openExternal"
        @link="followGuideLink"
      />

      <AccountsView
        v-else-if="route === 'accounts'"
        :profiles="snapshot.profiles"
        :selected="selected"
        :readiness="snapshot.readiness"
        @toggle="toggleProfile"
        @add="addOpen = true"
        @customize="editedProfile = $event.id"
        @show="showProfile"
        @play="playProfile"
        @cancel="cancelProfile"
        @restore="id => runAction('The account could not be restored.', () => native?.profiles.restore(id))"
        @delete="id => runAction('The account could not be deleted.', () => native?.profiles.delete(id))"
      />

      <HelpView v-else-if="route === 'help'" :send="sendFeedback" :page="helpPage" @external="openExternal" @url="openUrl" @settings="openSettings" @link="followGuideLink" />

      <SettingsView v-else :snapshot="settingsSnapshot" :native="native" :launcher="{ snapshot, native }" :target="settingsTarget" @fixture="snapshot = $event" @section="settingsSection = $event" @features="openSettings" />
    </main>

    <LaunchBar
      :snapshot="snapshot"
      :selected="selected"
      :busy="busy"
      :operation-error="operationError"
      :update-dismissed="updateBannerDismissed"
      @toggle="toggleProfile"
      @play="playProfile"
        @cancel="cancelProfile"
      @show="showProfile"
      @action="primaryAction"
      @manage="route = 'accounts'"
      :viewing-game-files="route === 'settings' && settingsSection === 'game-files'"
      @game-files="openSettings('game-files')"
      @dismiss-error="operationError = ''"
      @dismiss-update="updateBannerDismissed = true"
      @install-update="runAction('The update could not be installed.', () => native?.updates.restartAndInstall())"
    />

    <AccountDialogs v-model:adding="addOpen" v-model:editing="editedProfile" :profiles="snapshot.profiles" :native="native" @preview="snapshot = { ...snapshot, profiles: $event }" />

    <div v-if="snapshot.experience.preferencesReset" class="toast"><AlertTriangle /><div><strong>Launcher preferences were reset.</strong><span>Your accounts, saved login, game files, builds, and templates were not changed.</span></div><button class="icon-button" aria-label="Dismiss" @click="dismissPreferencesReset"><X /></button></div>
    <div v-else-if="snapshot.experience.showMigrationNotice" class="toast"><Check /><div><strong>{{ snapshot.experience.installationKind === 'migrated-single' ? 'Your existing account is ready.' : 'Your accounts are ready.' }}</strong><span>We kept your saved login, settings, builds, templates, and game files.</span></div><button class="icon-button" aria-label="Dismiss" @click="dismissMigrationNotice"><X /></button></div>

    <BaseModal v-if="snapshot.experience.setup === 'pending'" labelledby="setup-title" :dismissible="false" wide>
      <div class="setup-card">
        <template v-if="setupStep === 1"><h2 id="setup-title">Welcome to Guild Wars Reforged</h2><p>Guild Wars Reforged runs Guild Wars on your Mac. It is an unofficial community project and is not affiliated with ArenaNet or NCSOFT.</p><div class="form-actions"><button class="primary" @click="setupStep = 2">Continue</button></div></template>
        <template v-else><h2 id="setup-title">Features</h2><p>Features add to the game. Build Library saves team builds. Travel opens a map search. Xunlai Storage opens storage in supported outposts.</p><p><strong>Features apply to every account.</strong> You can change this later in Settings.</p><p class="setup-note">If you turn on Features, the app restarts once to finish setup.</p><p v-if="setupError" class="dialog-error" role="alert">{{ setupError }}</p><div class="form-actions spread"><button class="secondary" @click="setupStep = 1">Back</button><span /><button class="secondary" @click="completeSetup(false)">Play the plain game</button><button class="primary" @click="completeSetup(true)">Turn on Features</button></div></template>
      </div>
    </BaseModal>
  </div>
</template>
