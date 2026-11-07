/**
 * The Hub's Vue view, built as `tools/hub-app.js` beside the Tools bundle (vite.config.ts). Core
 * loads it without the Tools application, so it reaches only Vue, these components and
 * app/shared. A paint patches the DOM synchronously and applies the model's focus target in
 * the same call; the view measures what it drew and reports the geometry the controller records.
 */
import { h, render, type Ref, type VNode } from 'vue';
import type { EmbeddedHubView, HubFocusReader, HubLayoutReader, HubViewElements } from '../../../../shared/ui/hub-view';
import HubBuildDetails from './HubBuildDetails.vue';
import HubShell from './HubShell.vue';
import { hubDraftFields } from './drafts';
import { HUB_PAGES } from './views';

export const mountHubView: EmbeddedHubView['mountHubView'] = (parent, model) => {
  // A fresh props object per paint; the model's regions are replaced, never mutated, so only
  // the regions that changed redraw.
  const paint = (next: typeof model): VNode => { const vnode = h(HubShell, { model: { ...next } }); render(vnode, parent); return vnode; };
  const exposed = paint(model).component?.exposed as { root: Ref<HTMLDialogElement | undefined>; focus: HubFocusReader } | undefined;
  const root = exposed?.root.value;
  if (!exposed || !root) throw new Error('Hub view did not mount');
  const required = <T extends Element>(selector: string) => {
    const element = root.querySelector<T>(selector);
    if (!element) throw new Error(`Hub control missing: ${selector}`);
    return element;
  };
  const elements: HubViewElements = {
    root,
    panel: required('.hub-panel'), heading: required('.hub-heading'), lock: required('.hub-lock'), resize: required('.hub-resize'),
    back: required('.hub-back'), close: required('.hub-close'), input: required('.hub-search input'),
    results: required('.hub-results'), view: required('.hub-view'), primary: required('.hub-primary'), actions: required('.hub-actions'), menu: required('.hub-menu'),
  };
  const layout: HubLayoutReader = {
    frame: () => { const { left, bottom, width } = elements.panel.getBoundingClientRect(); return { left, bottom, width }; },
    scrollTop: () => elements.results.scrollTop,
    pageRows: () => Math.max(1, Math.floor(elements.results.clientHeight / (elements.results.querySelector<HTMLElement>('.hub-row')?.offsetHeight || 40)) - 1),
  };
  return {
    elements,
    paint,
    focus: exposed.focus,
    layout,
    drafts: hubDraftFields(elements.view),
    mountBuildDetails(target, builds) {
      const vnode = h(HubBuildDetails, { builds });
      render(vnode, target);
      return { element: vnode.el as HTMLElement, dispose: () => render(null, target) };
    },
    pages: HUB_PAGES,
    dispose: () => render(null, parent),
  };
};
