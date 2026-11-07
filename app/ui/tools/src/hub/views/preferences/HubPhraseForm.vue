<script setup lang="ts">
/**
 * The search-phrase form: the label stands above the field and a refused phrase says why beside
 * it (HUB-152). The field takes the keyboard when the page opens and again when a phrase is refused.
 */
import { onMounted, ref } from 'vue';
import type { HubPhraseFormProps } from '../../../../../../shared/ui/hub-pages';
import { useFocusZone } from '../../focus-zone';
import { usePageFocus } from '../page';

const props = defineProps<HubPhraseFormProps>();
const form = ref<HTMLFormElement>();
const field = ref<HTMLInputElement>();
useFocusZone(form);
usePageFocus(form, () => props.focus);
// The field owns its text from here on, as a value property and never an attribute; edits,
// a restored draft included, arrive as input events.
onMounted(() => {
  if (!field.value) return;
  field.value.value = props.initial;
  field.value.focus();
});
const input = () => props.input(field.value?.value ?? '');
</script>

<template>
  <form ref="form" class="hub-detail" novalidate @submit.prevent>
    <h2>{{ title }}</h2>
    <div class="ui-field">
      <label class="ui-field-label" for="hub-phrase">Search phrase</label>
      <input
        id="hub-phrase" ref="field" class="ui-input" maxlength="64" autocomplete="off" :spellcheck.prop="false" data-focus-key="phrase"
        :aria-invalid="error ? 'true' : undefined" :aria-describedby="error ? 'hub-phrase-error hub-phrase-hint' : 'hub-phrase-hint'"
        @input="input"
      >
      <p id="hub-phrase-hint" class="ui-field-hint">Type this exact phrase in Hub to find {{ title }}. Its name stays the same. Leave the field empty to remove the phrase.</p>
      <p id="hub-phrase-error" class="ui-field-error" role="alert" :hidden="!error">{{ error }}</p>
    </div>
  </form>
</template>
