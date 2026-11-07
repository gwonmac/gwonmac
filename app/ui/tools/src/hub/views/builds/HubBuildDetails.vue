<script setup lang="ts">
/** The Build details page: each build's skills with their descriptions and its invested attributes. */
import { HUB_WORKSPACE_ACTION } from '../../../../../../shared/hub';
import type { HubBuildDetail, HubBuildDetailsProps } from '../../../../../../shared/ui/hub-pages';
import HubBuildInfo from '../../HubBuildInfo.vue';

defineProps<HubBuildDetailsProps>();
type Build = HubBuildDetail;
const heading = (build: Build) => 'label' in build ? `${build.label}: ${build.title}` : `${build.title} · ${build.detail}`;
const attributes = (build: Build) => build.attributeStatus ?? build.attributes?.flatMap(group => group.attributes.map(attribute =>
  `${attribute.name} ${attribute.rank}${attribute.nextRank !== undefined && attribute.nextRank !== attribute.rank ? ` → ${attribute.nextRank}` : ''}`)).join(' · ') ?? '';
</script>

<template>
  <section class="hub-build-details ui-scroll" tabindex="0">
    <template v-for="(build, index) in builds" :key="index">
      <template v-if="build.skills">
        <h2>{{ heading(build) }}</h2>
        <button v-if="build.workspace" class="ui-button" @click="build.workspace">{{ HUB_WORKSPACE_ACTION }}</button>
        <HubBuildInfo :build="build" />
        <ol>
          <li v-for="(skill, at) in build.skills" :key="at"><strong>{{ skill.name }}</strong><p>{{ skill.description ?? 'Description not available.' }}</p></li>
        </ol>
        <p v-if="attributes(build)">Invested attributes: {{ attributes(build) }}</p>
      </template>
    </template>
  </section>
</template>
