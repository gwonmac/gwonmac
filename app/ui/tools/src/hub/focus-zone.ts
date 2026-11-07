/**
 * Owns one Hub focus zone: the arrow keys inside one region (the heading, the footer, the
 * Actions menu, a view's body), where ↑ or ↓ hands the keyboard to the next region, the
 * region's first control, and where the keyboard goes when the control that held it is
 * removed, hidden or disabled. A zone stops at its ends and never wraps. Combobox, select,
 * range, textarea, contenteditable and an overflowing scroller keep their own arrows (HUB-088).
 */
import { inject, onBeforeUnmount, onMounted, onUpdated, type InjectionKey, type Ref } from 'vue';
import { focusable, focusableElements } from '../../../../shared/ui/focusable';
import { listIndexAfter, listKeyStep } from '../../../../shared/ui/list-keys';

/**
 * How the zone moves: `horizontal` steps ← → along a toolbar, `list` takes the shared list
 * keys (↑ ↓ ⌃P ⌃N, pages, Home, End), and `screen` steps ↑ ↓ in screen order within the
 * focused control's column (a nav or a scrolled body, HUB-054). A zone without one only
 * keeps the keyboard when its control goes away.
 */
export type FocusZoneOrientation = 'horizontal' | 'list' | 'screen';
export type FocusZoneOptions = Readonly<{
  orientation?: FocusZoneOrientation;
  /** The zone's stops in order; its usable controls when absent. */
  controls?: () => readonly HTMLElement[];
  /** Where ↑ or ↓ hands the keyboard to the next zone. */
  exits?: Readonly<{ ArrowUp?: () => HTMLElement | null; ArrowDown?: () => HTMLElement | null }>;
  /** Where the keyboard goes when the zone's control goes away; the Hub's fallback when absent. */
  fallback?: () => HTMLElement | null;
  /** False where the zone's content moves the keyboard itself (a mounted view). */
  rescue?: boolean;
}>;

/** What the Hub shell gives its zones (useHubFocus): the fallback, the page's search and a lost control's key. */
export type FocusZoneHost = Readonly<{
  /** The search when the Hub search shows, else the view's first control, else Back. */
  fallback(): HTMLElement | null;
  /** The page's search: the Hub search, else the view's own search, else its first control. */
  search(): HTMLElement | null;
  /** A zone that held the keyboard unmounted; the shell finds the same control after the paint. */
  lost(key: string | null): void;
}>;
export const FOCUS_ZONE_HOST: InjectionKey<FocusZoneHost> = Symbol('hub focus zones');

/** How the launcher's Settings page names its controls: a section, a control's id or its label. */
const SETTINGS_IDENTITY = ['id', 'data-section', 'aria-label'] as const;
/**
 * A control's stable name across redraws and remounts: every Hub view names its controls with
 * `data-focus-key`, and a control without one has no name. The launcher's Settings page, which
 * the Hub hosts but does not draw, keeps its own names inside the Settings host: the identity a
 * control already carries, else the setting row it belongs to (docs/settings.md).
 */
export function focusKeyOf(element: Element): string | null {
  const own = element.getAttribute('data-focus-key');
  if (own) return own;
  if (!element.closest('.hub-settings-host')) return null;
  for (const attribute of SETTINGS_IDENTITY) {
    const value = element.getAttribute(attribute);
    if (value) return `${attribute}=${value}`;
  }
  const setting = element.closest<HTMLElement>('[data-setting]')?.dataset.setting;
  return setting ? `data-setting=${setting} ${element.tagName.toLowerCase()}` : null;
}

/** The first usable control in `root` with this key. */
export function findFocusKey(root: ParentNode, key: string): HTMLElement | null {
  return focusableElements(root).find(element => focusKeyOf(element) === key) ?? null;
}

const OWN_ARROWS = 'select,input[type="range"],input[role=combobox],textarea';
const clamp = (index: number, count: number) => Math.max(0, Math.min(count - 1, index));

export function useFocusZone(zone: Ref<HTMLElement | undefined>, options: FocusZoneOptions = {}) {
  const host = inject(FOCUS_ZONE_HOST, null);
  const controls = () => options.controls?.() ?? (zone.value ? focusableElements(zone.value) : []);
  /** The zone's control that last took the keyboard, until the keyboard leaves the zone. */
  let held: HTMLElement | null = null;

  function screenStep(target: HTMLElement, key: string) {
    const element = zone.value;
    if (!element || target.matches(OWN_ARROWS) || target.isContentEditable) return null;
    if (!target.matches('input,button,a[href],summary') && target.scrollHeight > target.clientHeight) return null;
    const column = target.parentElement?.closest<HTMLElement>('nav,.ui-scroll') ?? element;
    const ordered = focusableElements(element.contains(column) ? column : element).sort((a, b) => {
      const left = a.getBoundingClientRect(), right = b.getBoundingClientRect();
      return left.top - right.top || left.left - right.left;
    });
    const index = ordered.indexOf(target);
    return index < 0 ? null : ordered[clamp(index + (key === 'ArrowDown' ? 1 : -1), ordered.length)] ?? null;
  }

  function keydown(event: KeyboardEvent) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    if (options.orientation === 'list') {
      const items = controls();
      const step = listKeyStep(event, items.length);
      if (step === null) return;
      event.preventDefault();
      items[listIndexAfter(items.indexOf(target.ownerDocument.activeElement as HTMLElement), items.length, step)]?.focus();
      return;
    }
    if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    const exit = event.key === 'ArrowUp' || event.key === 'ArrowDown' ? options.exits?.[event.key] : undefined;
    if (exit) { event.preventDefault(); exit()?.focus(); return; }
    if (options.orientation === 'horizontal' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      const stops = controls();
      event.preventDefault();
      stops[clamp(stops.indexOf(target) + (event.key === 'ArrowRight' ? 1 : -1), stops.length)]?.focus();
    } else if (options.orientation === 'screen' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      const next = screenStep(target, event.key);
      if (!next) return;
      event.preventDefault();
      next.focus();
    }
  }
  const focusin = (event: FocusEvent) => { if (event.target instanceof HTMLElement) held = event.target; };
  // Focus that went nowhere (a removed or disabled control) stays held, so the zone can rescue it.
  const focusout = (event: FocusEvent) => { if (event.relatedTarget instanceof Node && !zone.value?.contains(event.relatedTarget)) held = null; };

  /**
   * After a redraw: a held control that is gone, hidden or disabled hands the keyboard to the
   * same control drawn again (by its key), else to the fallback, never to <body>.
   */
  function rescue() {
    const control = held;
    if (options.rescue === false || !control || (control.isConnected && focusable(control))) return;
    held = null;
    const document = control.ownerDocument, dialog = zone.value?.closest('dialog');
    if (dialog && !dialog.open) return;
    const active = document.activeElement;
    if (active && active !== control && active !== document.body && active !== dialog) return;
    const key = focusKeyOf(control);
    const same = key && zone.value ? findFocusKey(zone.value, key) : null;
    (same ?? (options.fallback ?? host?.fallback)?.())?.focus({ preventScroll: true });
  }

  let element: HTMLElement | undefined;
  onMounted(() => {
    element = zone.value;
    element?.addEventListener('keydown', keydown);
    element?.addEventListener('focusin', focusin);
    element?.addEventListener('focusout', focusout);
  });
  onUpdated(rescue);
  onBeforeUnmount(() => {
    // The whole zone goes (the Price basis moving to another row): the shell finds its control again.
    if (options.rescue !== false && held && element?.contains(held.ownerDocument.activeElement)) host?.lost(focusKeyOf(held));
    element?.removeEventListener('keydown', keydown);
    element?.removeEventListener('focusin', focusin);
    element?.removeEventListener('focusout', focusout);
  });

  return {
    /** The zone's first usable control. */
    first: (): HTMLElement | null => (zone.value ? focusableElements(zone.value)[0] : undefined) ?? null,
    rescue,
  };
}
