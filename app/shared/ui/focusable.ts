/**
 * Owns the one rule for a control the keyboard can use now: shown, enabled, not
 * hidden or inert. The surface controller's Tab wrapping, the Hub focus kit and
 * every "first usable control" focus share it, so focus never goes to a disabled
 * button, which refuses it and leaves <body>.
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
