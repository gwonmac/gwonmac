/**
 * Owns the UI sweep's layout rules: one function that runs inside the page and lists what a player
 * would see as broken. It knows nothing about any surface; the runner decides what to open.
 * Rules (each one a defect a player reported or would report):
 * - sideways-scroll: a box scrolls sideways, so part of it hides behind a scrollbar.
 * - control-cut-off: a button, link or field is cut by a clipping box or by the window.
 * - text-spill: text runs out of its box without an ellipsis.
 * - offscreen: a visible panel reaches past the window edge.
 * - overlap: two pieces of text or controls draw over each other.
 * - truncated (note only): a label ends in an ellipsis; fine for long names, worth a look elsewhere.
 * Pattern rules (DESIGN.md, "One pattern per job"):
 * - selection-stripe: a selected row or card marks itself with an edge stripe.
 * - selection-style: a selected row or card is drawn other than with the shared selection tokens.
 */
export type AuditFinding = Readonly<{ rule: string; target: string; detail: string }>;

/**
 * Runs in the browser; serialised by Playwright, so it may only use what it defines inside.
 * `ignore` is a selector for page parts that are not the product (a fixture's own controls).
 */
export function auditLayout(ignore: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const width = window.innerWidth;
  const height = window.innerHeight;
  const describe = (element: Element): string => {
    const parts: string[] = [];
    for (let node: Element | null = element; node && node !== document.body && parts.length < 3; node = node.parentElement) {
      const id = node.id ? `#${node.id}` : "";
      const classes = [...node.classList].filter((name) => !/^(v-|router-|is-|data-)/.test(name)).slice(0, 2).map((name) => `.${name}`).join("");
      parts.unshift(`${node.tagName.toLowerCase()}${id}${classes}`);
      if (id) break;
    }
    return parts.join(" > ");
  };
  // While a modal is open the page behind it is inert: only the topmost modal counts.
  const modals = [...document.querySelectorAll("dialog:modal, [aria-modal=true]")].filter((element) => element.checkVisibility());
  const modal = modals.at(-1) ?? null;
  const visible = (element: Element): boolean => {
    if (modal && !modal.contains(element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1 || (ignore && element.closest(ignore))) return false;
    // Also false inside a closed <details>, which Chrome still lays out.
    return element.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
  };
  const clips = (style: CSSStyleDeclaration) => style.overflowX !== "visible" || style.overflowY !== "visible";
  const controls = "button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=option]";

  for (const element of document.body.querySelectorAll("*")) {
    if (!visible(element)) continue;
    const style = getComputedStyle(element);
    const overX = element.scrollWidth - element.clientWidth;
    if ((style.overflowX === "auto" || style.overflowX === "scroll") && overX > 1) {
      findings.push({ rule: "sideways-scroll", target: describe(element), detail: `${overX}px hidden sideways` });
    }
    if (style.position === "fixed" || style.position === "absolute") {
      const rect = element.getBoundingClientRect();
      const out = Math.max(-rect.left, -rect.top, rect.right - width, rect.bottom - height);
      if (out > 1 && rect.width < width * 2 && style.pointerEvents !== "none" && element.matches("[role=dialog], dialog, [id], section, aside, form")) {
        findings.push({ rule: "offscreen", target: describe(element), detail: `${Math.round(out)}px past the window` });
      }
    }
    const ownText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
    if (ownText && overX > 1 && !element.matches("input, textarea, select")) {
      if (style.textOverflow === "ellipsis") findings.push({ rule: "truncated", target: describe(element), detail: JSON.stringify(element.textContent?.trim().slice(0, 40)) });
      else if (!clips(style)) findings.push({ rule: "text-spill", target: describe(element), detail: `${overX}px of ${JSON.stringify(element.textContent?.trim().slice(0, 40))}` });
    }
    if (element.matches(controls)) {
      const rect = element.getBoundingClientRect();
      // Every clipping box decides whether the control is in view at all; only the axes a box does
      // not scroll can cut it, since a row half scrolled out of a list is normal.
      let view = { left: 0, top: 0, right: width, bottom: height };
      let cutBox = { ...view };
      // Once a box scrolls in an axis, it decides what shows in that axis; frames around it do not.
      let scrolledX = false;
      let scrolledY = false;
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent);
        if (!clips(parentStyle)) continue;
        const r = parent.getBoundingClientRect();
        view = { left: Math.max(view.left, r.left), top: Math.max(view.top, r.top), right: Math.min(view.right, r.right), bottom: Math.min(view.bottom, r.bottom) };
        scrolledX ||= parentStyle.overflowX === "auto" || parentStyle.overflowX === "scroll";
        scrolledY ||= parentStyle.overflowY === "auto" || parentStyle.overflowY === "scroll";
        if (!scrolledX) cutBox = { ...cutBox, left: Math.max(cutBox.left, r.left), right: Math.min(cutBox.right, r.right) };
        if (!scrolledY) cutBox = { ...cutBox, top: Math.max(cutBox.top, r.top), bottom: Math.min(cutBox.bottom, r.bottom) };
      }
      const inView = rect.right > view.left && rect.left < view.right && rect.bottom > view.top && rect.top < view.bottom;
      const cut = Math.max(cutBox.left - rect.left, cutBox.top - rect.top, rect.right - cutBox.right, rect.bottom - cutBox.bottom);
      if (cut > 2 && inView) findings.push({ rule: "control-cut-off", target: describe(element), detail: `${Math.round(cut)}px of ${JSON.stringify((element.textContent ?? element.getAttribute("aria-label") ?? "").trim().slice(0, 30))} hidden` });
    }
  }
  // Selection: one treatment, the shared tokens, and never an edge stripe. Segments and tabs are
  // their own job (one choice from a short set), so they are not rows.
  const selected = [...document.body.querySelectorAll("[aria-selected=true], [data-active], [data-selected=true], :is(.ui-row, [role=option])[aria-current=page], .ui-selection-region[data-selected], .setting-focus")]
    .filter((element) => visible(element) && !element.matches("[role=tab], .ui-segment *, .ui-tab, .segmented *"));
  const insetStripe = (shadow: string) => shadow.split(/,(?![^(]*\))/).some((part) => {
    if (!part.includes("inset")) return false;
    const [x = 0, y = 0, blur = 0] = (part.replace(/rgba?\([^)]*\)|oklch\([^)]*\)|color\([^)]*\)/g, "").match(/-?[\d.]+px/g) ?? []).map(parseFloat);
    return blur === 0 && ((x !== 0 && y === 0) || (x === 0 && y !== 0));
  });
  const probe = (parent: Element) => {
    const element = document.createElement("span");
    element.style.cssText = "position:absolute;width:0;height:0;background:var(--ui-selection-fill);box-shadow:var(--ui-selection-shadow)";
    parent.append(element);
    const style = getComputedStyle(element);
    const expected = { background: style.backgroundImage, shadow: style.boxShadow };
    element.remove();
    return expected;
  };
  for (const element of selected) {
    const style = getComputedStyle(element);
    const stripes = [
      insetStripe(style.boxShadow) && "inset box-shadow",
      Math.abs(parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)) > 0.5 && style.borderLeftStyle !== "none" && "border-left",
      ...(["::before", "::after"] as const).map((pseudo) => {
        const mark = getComputedStyle(element, pseudo);
        if (mark.content === "none" || mark.display === "none") return false;
        const narrow = parseFloat(mark.width) <= 4 && (mark.backgroundColor !== "rgba(0, 0, 0, 0)" || mark.backgroundImage !== "none");
        const edged = parseFloat(mark.borderLeftWidth) > 1 && mark.borderLeftStyle !== "none";
        return (narrow || edged) && `${pseudo} bar`;
      }),
    ].filter(Boolean);
    if (stripes.length) findings.push({ rule: "selection-stripe", target: describe(element), detail: stripes.join(", ") });
    // Only the game's design system names the selection tokens; the launcher has its own.
    if (!getComputedStyle(element).getPropertyValue("--ui-selection-fill").trim() || element.matches(".setting-focus")) continue;
    const expected = probe(element.parentElement ?? document.body);
    if (style.backgroundImage !== expected.background || style.boxShadow !== expected.shadow) {
      findings.push({ rule: "selection-style", target: describe(element), detail: `background ${style.backgroundImage === expected.background ? "matches" : "differs"}, shadow ${style.boxShadow === expected.shadow ? "matches" : `is ${style.boxShadow.slice(0, 60)}`}` });
    }
  }
  // Overlap: leaves that carry text, and controls, that are not inside one another.
  const pieces = [...document.body.querySelectorAll("*")].filter((element) => visible(element) && (element.matches(controls)
    || [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())));
  // The part of each piece that shows: cut to every clipping box around it and to the window.
  const shownRect = (element: Element) => {
    const r = element.getBoundingClientRect();
    let box = { left: Math.max(0, r.left), top: Math.max(0, r.top), right: Math.min(width, r.right), bottom: Math.min(height, r.bottom) };
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (!clips(getComputedStyle(parent))) continue;
      const c = parent.getBoundingClientRect();
      box = { left: Math.max(box.left, c.left), top: Math.max(box.top, c.top), right: Math.min(box.right, c.right), bottom: Math.min(box.bottom, c.bottom) };
    }
    return box.right - box.left > 1 && box.bottom - box.top > 1 ? box : null;
  };
  const boxes = pieces.flatMap((element) => { const rect = shownRect(element); return rect ? [{ element, rect, lines: [...element.getClientRects()] }] : []; });
  // Wrapped inline text has one box per line; their union overlaps whatever shares those lines.
  const linesMeet = (a: typeof boxes[number], b: typeof boxes[number]) => a.lines.some((p) => b.lines.some((q) =>
    Math.min(p.right, q.right) - Math.max(p.left, q.left) > 4 && Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top) > 4));
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]!; const b = boxes[j]!;
      if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
      const x = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
      const y = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
      if (x <= 4 || y <= 4 || !linesMeet(a, b)) continue;
      // A button placed inside a field (search, clear) is a pattern, not a collision.
      const inside = (outer: typeof a, inner: typeof a) => outer.element.matches("input, textarea, select")
        && inner.rect.left >= outer.rect.left - 2 && inner.rect.right <= outer.rect.right + 2 && inner.rect.top >= outer.rect.top - 2 && inner.rect.bottom <= outer.rect.bottom + 2;
      if (inside(a, b) || inside(b, a)) continue;
      // Something drawn over both (a dialog over the page) means neither shows there.
      const top = document.elementFromPoint((Math.max(a.rect.left, b.rect.left) + Math.min(a.rect.right, b.rect.right)) / 2, (Math.max(a.rect.top, b.rect.top) + Math.min(a.rect.bottom, b.rect.bottom)) / 2);
      if (!top || !(a.element.contains(top) || b.element.contains(top))) continue;
      findings.push({ rule: "overlap", target: `${describe(a.element)} × ${describe(b.element)}`, detail: `${Math.round(x)}×${Math.round(y)}px` });
    }
  }
  return findings;
}
