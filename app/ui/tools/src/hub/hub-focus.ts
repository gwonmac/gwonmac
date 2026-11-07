/**
 * Owns where the Hub's keyboard goes. It applies the controller's focus target once, after the
 * paint that carries it, and selects a resumed Hub search; finds a control again by its key;
 * lets a restored page's control that mounts late still take the keyboard until the player
 * acts; keeps the keyboard where it was when a press parks it on the dialog (HUB-246); and
 * names the fallback every zone shares: the
 * search when it shows, else the view's first control, else Back, so focus never lands on <body>.
 */
import { onBeforeUnmount, onMounted, onUpdated, provide, watch, type Ref } from 'vue';
import type { HubFocusReader, HubFocusRequest, HubFocusTarget, HubFocusZone, HubViewModel } from '../../../../shared/ui/hub-view';
import { focusable, focusableElements } from '../../../../shared/ui/focusable';
import { FOCUS_ZONE_HOST, findFocusKey, focusKeyOf } from './focus-zone';

export function useHubFocus(root: Ref<HTMLDialogElement | undefined>, view: Ref<HTMLElement | undefined>, model: () => HubViewModel): HubFocusReader {
  const part = <T extends Element>(selector: string) => root.value?.querySelector<T>(selector) ?? null;
  const input = () => part<HTMLInputElement>('.hub-search input');
  const firstControl = () => (view.value ? focusableElements(view.value)[0] : undefined) ?? part<HTMLElement>('.hub-back');
  const searchField = () => !model().search.hidden ? input()
    : [...view.value?.querySelectorAll<HTMLInputElement>('input[type=search],input[role=combobox]') ?? []].find(field => field.getClientRects().length > 0 && !field.disabled) ?? null;
  const fallback = () => model().search.hidden ? firstControl() : input();
  const first = (selector: string, usable: (element: HTMLElement) => boolean) => [...root.value?.querySelectorAll<HTMLElement>(selector) ?? []].find(usable) ?? null;

  /** A zone's first control, or the control a key names; null where neither shows. */
  function resolve(target: HubFocusTarget): HTMLElement | null {
    if (target.key) return root.value ? findFocusKey(root.value, target.key) : null;
    switch (target.zone) {
      case 'search': return searchField() ?? firstControl();
      case 'results': return model().search.hidden ? null : input();
      case 'view': return model().view.hidden ? null : firstControl();
      case 'heading': return first('.hub-heading button', button => !button.hidden && button.getClientRects().length > 0);
      case 'footer': return first('.hub-footer button', focusable);
      case 'menu': return first('.hub-menu-item', focusable);
    }
  }
  function place(element: HTMLElement, target: HubFocusTarget) {
    element.focus({ preventScroll: true });
    if (target.range && element instanceof HTMLInputElement && element.selectionStart !== null) element.setSelectionRange(...target.range);
  }

  let waiting: MutationObserver | null = null;
  const stopWaiting = () => { waiting?.disconnect(); waiting = null; };
  /** A zone whose control held the keyboard unmounted during this paint; its key, or null. */
  let lost: string | null | undefined;
  function apply(request: HubFocusRequest) {
    stopWaiting(); lost = undefined;
    const element = resolve(request);
    if (element) place(element, request);
    else fallback()?.focus({ preventScroll: true });
    const search = input();
    if (request.select && search && root.value?.ownerDocument.activeElement === search) search.select();
    if (element) return;
    const key = request.key;
    if (!request.wait || !key || !view.value) return;
    waiting = new MutationObserver(() => {
      const control = root.value ? findFocusKey(root.value, key) : null;
      if (control) { stopWaiting(); place(control, request); }
    });
    waiting.observe(view.value, { childList: true, subtree: true });
  }
  watch(() => model().focus?.seq, () => { const request = model().focus; if (request) apply(request); }, { flush: 'post' });

  provide(FOCUS_ZONE_HOST, { fallback, search: () => searchField() ?? firstControl(), lost: key => { lost = key; } });
  onUpdated(() => {
    if (lost === undefined) return;
    const key = lost, dialog = root.value;
    lost = undefined;
    const active = dialog?.ownerDocument.activeElement;
    if (!dialog?.open || (active && active !== dialog.ownerDocument.body && active !== dialog)) return;
    ((key ? findFocusKey(dialog, key) : null) ?? fallback())?.focus({ preventScroll: true });
  });

  // A press on blank panel space or a disabled control parks focus on the dialog itself, as does
  // a view's own dialog root (Characters, HUB-246): the keyboard returns to its last control.
  let last: HTMLElement | null = null;
  const keepPlace = () => {
    const usable = !!last?.isConnected && !!root.value?.contains(last) && focusable(last);
    (usable ? last : fallback())?.focus({ preventScroll: true });
  };
  const focusin = (event: FocusEvent) => {
    if (event.target instanceof HTMLDialogElement && event.target !== root.value) keepPlace();
    else if (event.target !== root.value && event.target instanceof HTMLElement) last = event.target;
  };
  let dialog: HTMLDialogElement | undefined;
  onMounted(() => {
    dialog = root.value;
    dialog?.addEventListener('focusin', focusin);
    dialog?.addEventListener('focus', keepPlace);
    // The player's own key or press ends the wait for a late control.
    dialog?.addEventListener('keydown', stopWaiting);
    dialog?.addEventListener('pointerdown', stopWaiting);
  });
  onBeforeUnmount(() => {
    stopWaiting();
    dialog?.removeEventListener('focusin', focusin);
    dialog?.removeEventListener('focus', keepPlace);
    dialog?.removeEventListener('keydown', stopWaiting);
    dialog?.removeEventListener('pointerdown', stopWaiting);
  });

  const zoneOf = (element: Element): HubFocusZone | null => element === input() || element.closest('.hub-rate-controls') ? 'results'
    : element.closest('.hub-heading') ? 'heading' : element.closest('.hub-footer') ? 'footer' : element.closest('.hub-menu') ? 'menu'
      : view.value?.contains(element) ? 'view' : null;
  const active = () => { const element = root.value?.ownerDocument.activeElement; return element instanceof HTMLElement && root.value?.contains(element) ? element : null; };
  return {
    capture() {
      const element = active() ?? root.value?.ownerDocument.activeElement;
      const range = element instanceof HTMLInputElement && element.selectionStart !== null
        ? { range: [element.selectionStart, element.selectionEnd ?? element.selectionStart] as const } : {};
      const key = element instanceof HTMLElement && element === active() && element !== input() ? focusKeyOf(element) : null;
      return key ? { zone: zoneOf(element as HTMLElement) ?? 'view', key, ...range } : { zone: 'results', ...range };
    },
    at() { const element = active(); return element ? zoneOf(element) : null; },
    searchField,
  };
}
