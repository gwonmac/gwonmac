/**
 * Puts one setting in view on a Settings or Feature page (docs/settings.md): opens the
 * disclosures that hold the control marked `data-setting="<id>"`, scrolls it to the middle,
 * focuses its first usable control when asked, and marks it briefly.
 */
let highlightTimer: ReturnType<typeof setTimeout> | undefined;

/** False when the page draws no such control (its Feature is off, or the host may not change it). */
export function revealSetting(root: HTMLElement, id: string, takeFocus: boolean): boolean {
  const row = root.querySelector<HTMLElement>(`[data-setting="${CSS.escape(id)}"]`);
  if (!row) return false;
  for (let parent = row.parentElement; parent && parent !== root; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  }
  row.scrollIntoView({ block: "center", container: "nearest" });
  const control = row.matches("input, select, button, textarea") ? row : row.querySelector<HTMLElement>("input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea");
  if (takeFocus) (control ?? row).focus({ preventScroll: true });
  root.ownerDocument.querySelectorAll(".setting-focus").forEach(element => element.classList.remove("setting-focus"));
  row.classList.add("setting-focus");
  clearTimeout(highlightTimer);
  highlightTimer = setTimeout(() => row.classList.remove("setting-focus"), 2400);
  return true;
}
