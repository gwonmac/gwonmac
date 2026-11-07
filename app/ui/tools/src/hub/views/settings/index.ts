/** Names this folder's Hub pages for the page registry (../index.ts): the host the launcher's Settings page mounts into. */
import type { HubPageComponents } from '../page';
import HubSettingsHost from './HubSettingsHost.vue';

export default { settingsHost: HubSettingsHost } satisfies HubPageComponents;
