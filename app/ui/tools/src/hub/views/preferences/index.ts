/** Names this folder's Hub pages for the page registry (../index.ts): Hub preferences and the search-phrase form. */
import type { HubPageComponents } from '../page';
import HubPreferences from './HubPreferences.vue';
import HubPhraseForm from './HubPhraseForm.vue';

export default { preferences: HubPreferences, phraseForm: HubPhraseForm } satisfies HubPageComponents;
