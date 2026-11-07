/**
 * The Hub's own pages, one folder per page (app/shared/ui/hub-pages.ts). They are part of the Hub
 * view module, so Core draws them without the Tools application.
 */
import type { HubPages } from '../../../../../shared/ui/hub-pages';
import HubConfirm from './confirm/HubConfirm.vue';
import { mountPage } from './page';
import HubPhraseForm from './preferences/HubPhraseForm.vue';
import HubPreferences from './preferences/HubPreferences.vue';

export const HUB_PAGES: HubPages<HTMLElement> = {
  confirm: (target, props) => mountPage(HubConfirm, target, props),
  phraseForm: (target, props) => mountPage(HubPhraseForm, target, props),
  preferences: (target, props) => mountPage(HubPreferences, target, props),
};
