/**
 * The Hub's own pages, one folder per page (app/shared/ui/hub-pages.ts). They are part of the Hub
 * view module, so Core draws them without the Tools application.
 */
import type { HubPages } from '../../../../../shared/ui/hub-pages';
import HubPriceDetails from './calculator/HubPriceDetails.vue';
import HubRatesForm from './calculator/HubRatesForm.vue';
import HubConfirm from './confirm/HubConfirm.vue';
import { mountPage } from './page';
import HubPhraseForm from './preferences/HubPhraseForm.vue';
import HubPreferences from './preferences/HubPreferences.vue';
import HubSettingsHost from './settings/HubSettingsHost.vue';

export const HUB_PAGES: HubPages<HTMLElement> = {
  confirm: (target, props) => mountPage(HubConfirm, target, props),
  phraseForm: (target, props) => mountPage(HubPhraseForm, target, props),
  preferences: (target, props) => mountPage(HubPreferences, target, props),
  rates: (target, props) => mountPage(HubRatesForm, target, props),
  priceDetails: (target, props) => mountPage(HubPriceDetails, target, props),
  settingsHost: (target, props) => mountPage(HubSettingsHost, target, props),
};
