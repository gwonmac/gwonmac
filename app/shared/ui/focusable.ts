/**
 * Owns the one rule for a control the keyboard can use now: shown, enabled, not
 * hidden or inert. The surface controller's Tab wrapping, the launcher's modal
 * focus trap, the Hub focus kit, the tablist move and every "first usable
 * control" focus share it, so focus never goes to a disabled button, which
 * refuses it and leaves <body>.
 */

const FOCUSABLE = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function focusable(element: Element): element is HTMLElement {
  return element instanceof HTMLElement
    && element.matches(FOCUSABLE)
    && !element.matches(":disabled")
    && !element.hidden
    && element.getAttribute("aria-hidden") !== "true"
    && element.closest("[hidden], [inert]") === null
    && element.getClientRects().length > 0;
}

/** The usable controls in `root`, in document order. */
export function focusableElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(focusable);
}

/**
 * The tablist move of the keyboard contract, shared by the launcher's Home tabs
 * and the Tools workbench tabs: ← → step and wrap, Home End jump. The tablist
 * keeps its own state; the move focuses the tab and clicks it.
 */
export function navigateTabs(event: KeyboardEvent): void {
  if (!(event.currentTarget instanceof HTMLElement)) return;
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')].filter(focusable);
  const current = tabs.findIndex((tab) => tab === event.target);
  if (current < 0) return;

  const next = event.key === "Home"
    ? 0
    : event.key === "End"
      ? tabs.length - 1
      : event.key === "ArrowLeft"
        ? (current - 1 + tabs.length) % tabs.length
        : event.key === "ArrowRight"
          ? (current + 1) % tabs.length
          : null;
  if (next === null) return;
  event.preventDefault();
  tabs[next]?.focus();
  tabs[next]?.click();
}
