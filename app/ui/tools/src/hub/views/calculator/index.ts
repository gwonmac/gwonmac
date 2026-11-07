/** Names this folder's Hub pages for the page registry (../index.ts): the calculator's Conversion rates form and Price details. */
import type { HubPageComponents } from '../page';
import HubRatesForm from './HubRatesForm.vue';
import HubPriceDetails from './HubPriceDetails.vue';

export default { rates: HubRatesForm, priceDetails: HubPriceDetails } satisfies HubPageComponents;
