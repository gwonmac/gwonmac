<script setup lang="ts">
/**
 * The Home screen section of Settings: the simple launcher, what Home shows, and the news
 * sources and rotation.
 */
import { LAUNCHER_CONTENT_KINDS, type LauncherPreferencesPatch, type LauncherSnapshot } from "@shared/launcher-contracts";
import { saveChoice } from "../select-choice";
import FeatureSwitch from "./FeatureSwitch.vue";

defineProps<{ content: LauncherSnapshot["preferences"]["content"]; save: (content: NonNullable<LauncherPreferencesPatch["content"]>) => Promise<void> }>();
</script>

<template>
  <h1>Home screen</h1>
  <div class="setting-group">
    <div class="setting-row" data-setting="content.simple"><span><strong>Simple launcher</strong><small id="home-simple-help">Open on Accounts and hide Home, News and Help. The launcher is then only for accounts and settings.</small></span><FeatureSwitch :checked="content.simple === true" label="Simple launcher" describedby="home-simple-help" @change="save({ simple: $event })" /></div>
  </div>
  <template v-if="!content.simple">
  <p class="section-intro">Choose what the launcher's Home shows.</p>
  <div class="setting-group">
    <div class="setting-row" data-setting="content.news"><span><strong>News</strong><small id="home-news-help">Game, event, and GWonMac updates.</small></span><FeatureSwitch :checked="content.news" label="News" describedby="home-news-help" @change="save({ news: $event })" /></div>
    <div class="setting-row" data-setting="content.dailies"><span><strong>Dailies</strong><small id="home-dailies-help">Daily activities and the weekly schedule.</small></span><FeatureSwitch :checked="content.dailies" label="Dailies" describedby="home-dailies-help" @change="save({ dailies: $event })" /></div>
    <label v-if="content.news && content.dailies"><span><strong>First Home tab</strong></span><select :value="content.first" @change="saveChoice($event, LAUNCHER_CONTENT_KINDS, (first) => save({ first }))"><option value="news">News</option><option value="dailies">Dailies</option></select></label>
  </div>
  <template v-if="content.news">
    <h2 class="settings-subheading">News sources</h2>
    <div class="setting-group">
      <div class="setting-row"><span><strong>Guild Wars updates</strong><small id="home-officialNews-help">Official game update notes from the Guild Wars Wiki.</small></span><FeatureSwitch :checked="content.officialNews" label="Guild Wars updates" describedby="home-officialNews-help" @change="save({ officialNews: $event })" /></div>
      <div class="setting-row"><span><strong>Upcoming events</strong><small id="home-eventNews-help">Important seasonal events and their dates.</small></span><FeatureSwitch :checked="content.eventNews" label="Upcoming events" describedby="home-eventNews-help" @change="save({ eventNews: $event })" /></div>
      <div class="setting-row"><span><strong>GWonMac releases</strong><small id="home-reforgedNews-help">Player-focused release notes.</small></span><FeatureSwitch :checked="content.reforgedNews" label="GWonMac releases" describedby="home-reforgedNews-help" @change="save({ reforgedNews: $event })" /></div>
      <div class="setting-row"><span><strong>Rotate featured news</strong><small id="home-autoRotateNews-help">Change the featured story every 12 seconds. Reduced Motion always turns rotation off.</small></span><FeatureSwitch :checked="content.autoRotateNews" label="Rotate featured news" describedby="home-autoRotateNews-help" @change="save({ autoRotateNews: $event })" /></div>
    </div>
  </template>
  </template>
</template>
