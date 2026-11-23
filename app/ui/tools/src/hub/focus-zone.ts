/**
 * Owns one Hub focus zone: the arrow keys inside one region (the heading, the footer, the
 * Actions menu, a view's body), where ↑ or ↓ hands the keyboard to the next region, the
 * region's first control, and where the keyboard goes when the control that held it is
 * removed, hidden or disabled. A zone stops at its ends and never wraps. Combobox, select,
 * range, textarea, contenteditable and an overflowing scroller keep their own arrows (HUB-088).
 */
import { inject, onBeforeUnmount, onMounted, onUpdated, type InjectionKey, type Ref } from 'vue';
import { focusable, focusableElements } from '../../../../shared/ui/focusable';
import { navTarget, rove } from '../../../../shared/ui/keyboard-nav';

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
  /** Where ↑ or ↓ hands the keyboard to the next zone (keyboard-nav's region handoff). */
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
/** A column ↑ ↓ stay inside: a nav, a scrolled well, or the launcher Settings page's scrolled body, beside its section nav. */
const COLUMN = 'nav,.ui-scroll,.hub-settings-host .settings-content';

export function useFocusZone(zone: Ref<HTMLElement | undefined>, options: FocusZoneOptions = {}) {
  const host = inject(FOCUS_ZONE_HOST, null);
  const controls = () => options.controls?.() ?? (zone.value ? focusableElements(zone.value) : []);
  /** The zone's control that last took the keyboard, until the keyboard leaves the zone. */
  let held: HTMLElement | null = null;

  /** The control ↑ or ↓ reaches in screen order within the target's column; null where the target keeps its arrows. */
  function screenStep(event: KeyboardEvent, target: HTMLElement) {
    const element = zone.value;
    if (!element || target.matches(OWN_ARROWS) || target.isContentEditable) return null;
    if (!target.matches('input,button,a[href],summary') && target.scrollHeight > target.clientHeight) return null;
    const column = target.parentElement?.closest<HTMLElement>(COLUMN) ?? element;
    const ordered = focusableElements(element.contains(column) ? column : element).sort((a, b) => {
      const left = a.getBoundingClientRect(), right = b.getBoundingClientRect();
      return left.top - right.top || left.left - right.left;
    });
    const index = ordered.indexOf(target);
    const move = index < 0 ? null : navTarget(event, { index, count: ordered.length }, { ends: false });
    return move ? ordered[move.index] ?? null : null;
  }

  function keydown(event: KeyboardEvent) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    if (options.orientation === 'list') {
      const items = controls();
      rove(event, items, { page: items.length });
      return;
    }
    if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    if (options.orientation === 'screen' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      const next = screenStep(event, target);
      if (!next) return;
      event.preventDefault();
      next.focus();
      return;
    }
    rove(event, options.orientation === 'horizontal' ? controls() : [], { vertical: 'none', horizontal: options.orientation === 'horizontal', ends: false, exits: options.exits });
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
