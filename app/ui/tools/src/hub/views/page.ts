/**
 * Owns how the kit draws one of the Hub's own pages into the view host the controller gives it:
 * a synchronous Vue render, so the controller can read and measure the page right after a draw,
 * and a page's focus request, applied once per new `seq` after the paint that carries it.
 */
import { h, render, watch, type Component, type Ref } from 'vue';
import type { HubPage, HubPageFocus, HubPageProps } from '../../../../../shared/ui/hub-pages';
import { findFocusKey } from '../focus-zone';

/** A page folder's pages by the name views mount them with (HubPageProps). */
export type HubPageComponents = Partial<Readonly<Record<keyof HubPageProps, Component>>>;

export function mountPage<Props extends object>(component: Component, target: HTMLElement, props: Props): HubPage<Props, HTMLElement> {
  // A fresh props object per draw, so every fact the controller passes is compared again.
  const draw = (next: Props) => { const vnode = h(component, { ...next }); render(vnode, target); return vnode; };
  const element = draw(props).el;
  if (!(element instanceof HTMLElement)) throw new Error('Hub page did not mount');
  return { element, update: next => { draw(next); }, dispose: () => render(null, target) };
}

/**
 * Puts the keyboard on the page's control with the requested key, once per request. A page that
 * scrolls its own content into view (a carousel) focuses without scrolling.
 */
export function usePageFocus(root: Ref<HTMLElement | undefined>, request: () => HubPageFocus | undefined, options: FocusOptions = {}) {
  watch(() => request()?.seq, () => {
    const key = request()?.key;
    if (key && root.value) findFocusKey(root.value, key)?.focus(options);
  }, { flush: 'post' });
}
