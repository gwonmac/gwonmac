<script setup lang="ts">
/** A build's skill bar and invested attributes, as rows, the summary and Build details show them. */
import type { HubRow } from '../../../../shared/hub';
import HubImage from './HubImage.vue';

defineProps<{ build: Pick<HubRow, 'skills' | 'attributes' | 'attributeStatus'> }>();
type Attribute = NonNullable<HubRow['attributes']>[number]['attributes'][number];
const rank = (attribute: Attribute) => `${attribute.rank}${attribute.nextRank !== undefined && attribute.nextRank !== attribute.rank ? ` → ${attribute.nextRank}` : ''}`;
</script>

<template>
  <span class="hub-build-info">
    <span v-if="build.skills" class="hub-skill-bar">
      <span
        v-for="(skill, index) in build.skills" :key="index" class="hub-skill"
        :data-elite="skill.elite ? 'true' : undefined" :data-changed="skill.changed ? 'true' : undefined"
        :title="`${index + 1}. ${skill.name}${skill.changed ? ' · will change' : ''}`" role="img" :aria-label="`${index + 1}. ${skill.name}`"
        :aria-description="skill.changed ? 'This slot will change.' : undefined"
      >{{ index + 1 }}<HubImage v-if="skill.iconUrl" :src="skill.iconUrl" /></span>
    </span>
    <span class="hub-attributes">
      <template v-if="build.attributeStatus">{{ build.attributeStatus }}</template>
      <template v-else>
        <span v-for="(group, at) in build.attributes ?? []" :key="at" class="hub-attribute-group">
          <img :src="group.icon" :alt="group.name" :title="group.name">
          <span
            v-for="(attribute, position) in group.attributes" :key="position" class="hub-attribute"
            :title="`${attribute.name}: ${rank(attribute)} invested ranks`" role="img"
            :aria-label="`${attribute.name} ${rank(attribute)}`" aria-description="Invested ranks"
          >{{ attribute.label }}<b>{{ rank(attribute) }}</b></span>
        </span>
      </template>
    </span>
  </span>
</template>
