<script setup lang="ts">
/**
 * One result: a currency conversion card, or an icon, title, detail and keys, with a build's
 * skills and attributes below. Its name and description carry what the icons show. A selected
 * priced row also holds its Price basis picker.
 */
import { computed } from 'vue';
import type { HubRow } from '../../../../shared/hub';
import type { HubShortcutBindings } from '../../../../shared/ui/hub-view';
import { shortcutKeycaps } from '../../../../shared/keyboard-shortcuts';
import { HUB_COMMAND_SHORTCUTS } from '../../../../shared/tool-presentation';
import HubBuildInfo from './HubBuildInfo.vue';
import HubIcon from './HubIcon.vue';
import HubImage from './HubImage.vue';
import HubProfessions from './HubProfessions.vue';
import HubRateControls from './HubRateControls.vue';
import HubTitleLabels from './HubTitleLabels.vue';

const props = defineProps<{
  row: HubRow; index: number; selected: boolean;
  /** Home's empty search shows builds compact. */
  compact: boolean;
  bindings: HubShortcutBindings;
  /** The list is hidden under a view; the picker it holds hides with it. */
  listHidden: boolean;
}>();

const classes = computed(() => props.row.conversion ? ['hub-row', 'hub-conversion']
  : props.row.skills ? ['hub-row', 'hub-build-row', ...(props.compact ? ['hub-build-compact'] : [])] : ['hub-row']);
const label = computed(() => props.row.conversion ? `${props.row.conversion.input} equals ${props.row.title}. ${props.row.detail}`
  : props.row.skills ? props.row.title : undefined);
const description = computed(() => [props.row.skills ? props.row.unavailable ?? props.row.detail : '',
  props.row.professions?.map(profession => profession.name).join(' / '),
  props.row.skills ? `Skills: ${props.row.skills.map(skill => skill.name).join(', ')}` : '',
  props.row.navigate ? 'Right Arrow opens the child page.' : ''].filter(Boolean).join('. ') || undefined);
const keyRow = computed(() => props.row.id.startsWith('key:'));
const shortcut = computed(() => HUB_COMMAND_SHORTCUTS[keyRow.value ? props.row.id.slice(4) : props.row.id]);
// A key row names its keys as keycaps; its detail stays only for a fixed key or one not set.
const detail = computed(() => keyRow.value && !props.row.unavailable && props.row.detail !== 'Not set' ? '' : props.row.unavailable ?? props.row.detail);
const keycaps = computed((): readonly { label: string; name?: string }[] => keyRow.value && !shortcut.value ? [...props.row.detail].map(label => ({ label }))
  : shortcut.value ? shortcutKeycaps(props.bindings[shortcut.value]) : []);
</script>

<template>
  <div
    :id="`hub-result-${index}`" :data-id="row.id" :class="classes" role="option"
    :aria-selected="selected" :aria-disabled="!!row.unavailable" :aria-label="label" :aria-description="description"
    :data-destructive="row.destructive ? 'true' : undefined" :data-read-only="row.readOnly ? 'true' : undefined"
  >
    <template v-if="row.conversion">
      <span class="hub-title">{{ row.title }}<HubTitleLabels :professions="row.professions" :folder="row.folder" /></span>
      <span class="hub-detail" v-text="row.unavailable ?? row.detail"></span>
      <strong class="hub-conversion-input">{{ row.conversion.input }}</strong>
      <span class="hub-currency hub-currency-from">{{ row.conversion.from }}</span>
      <span class="hub-currency hub-currency-to">{{ row.conversion.to }}</span>
      <span class="hub-row-arrow" aria-hidden="true">→</span>
      <HubImage v-if="row.conversion.iconFrom" :src="row.conversion.iconFrom" class="hub-conversion-art hub-conversion-art-from" />
      <HubImage v-if="row.conversion.iconTo" :src="row.conversion.iconTo" class="hub-conversion-art hub-conversion-art-to" />
    </template>
    <template v-else>
      <HubProfessions v-if="row.professions?.length" :professions="row.professions" />
      <HubIcon v-else :row="row" />
      <span class="hub-title">{{ row.title }}<HubTitleLabels :professions="row.professions" :folder="row.folder" /></span>
      <span class="hub-detail" :hidden="!detail" v-text="detail"></span>
      <span class="hub-row-type">
        <kbd v-for="(cap, index) in keycaps" :key="index" class="ui-kbd" :aria-label="cap.name">{{ cap.label }}</kbd>
        <span v-if="row.navigate" class="hub-child-cue" aria-hidden="true">›</span>
      </span>
      <HubBuildInfo v-if="row.skills" :build="row" />
    </template>
    <HubRateControls v-if="selected && row.quoteBasis" :basis="row.quoteBasis" :hidden="listHidden" />
  </div>
</template>
