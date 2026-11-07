/**
 * The Hub's page registry. Each page folder names its pages in an `index.ts`, the Hub's own
 * folders here and a feature's `app/features/<id>/hub-views/` alike, so a feature adds a page
 * from its own folder: the component, its `index.ts` and the props it adds to `HubPageProps`
 * (app/shared/ui/hub-pages.ts). The pages are part of the Hub view module, so Core draws them
 * without the Tools application.
 */
import type { Component } from 'vue';
import type { HubPages } from '../../../../../shared/ui/hub-pages';
import { mountPage, type HubPageComponents } from './page';

const folders = import.meta.glob<{ default: HubPageComponents }>(['./*/index.ts', '../../../../../features/*/hub-views/index.ts'], { eager: true });
const components = new Map<string, Component>();
for (const [path, folder] of Object.entries(folders)) for (const [name, component] of Object.entries(folder.default)) {
  if (!component) continue;
  if (components.has(name)) throw new Error(`Hub page ${name} is named twice (${path})`);
  components.set(name, component);
}

export const HUB_PAGES: HubPages<HTMLElement> = {
  mount(name, target, props) {
    const component = components.get(name);
    if (!component) throw new Error(`Hub page ${name} has no component`);
    return mountPage(component, target, props);
  },
};
