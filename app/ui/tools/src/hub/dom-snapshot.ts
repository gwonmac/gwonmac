/**
 * Serializes the Hub's DOM for its snapshot tests: one line per element with sorted attributes
 * and merged text, and where the keyboard is. Comments and empty text are left out, so a Vue
 * redraw and a hand-built page of the same structure serialize alike.
 */

/** One line per node: sorted attributes, merged text, no comments or empty text. */
export function serializeDom(node: Node, depth = 0): string[] {
  const pad = '  '.repeat(depth);
  if (!(node instanceof Element)) return [];
  // Vite serves imported images from the checkout's absolute path; keep the snapshot machine-independent.
  const attributes = [...node.attributes].map(attribute => `${attribute.name}="${attribute.value.replace(/^.*\/@fs\/.*?\/app\//, 'app/')}"`).sort();
  if ((node instanceof HTMLInputElement || node instanceof HTMLSelectElement) && node.value) attributes.push(`.value="${node.value}"`);
  const lines = [`${pad}<${node.tagName.toLowerCase()}${attributes.length ? ` ${attributes.join(' ')}` : ''}>`];
  let text = '';
  const flush = () => { if (text.trim()) lines.push(`${pad}  ${JSON.stringify(text)}`); text = ''; };
  // innerHTML-set SVG markup is compared as markup.
  if (node instanceof SVGElement && node.tagName.toLowerCase() === 'svg') { lines.push(`${pad}  ${node.innerHTML}`); return lines; }
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? '';
    else if (child instanceof Element) { flush(); lines.push(...serializeDom(child, depth + 1)); }
  }
  flush();
  return lines;
}

/** The focused element as tag, id, classes and accessible name; `body` when nothing has focus. */
export function describeFocus(document: Document): string {
  const active = document.activeElement;
  if (!active || active === document.body) return 'body';
  return `${active.tagName.toLowerCase()}${active.id ? `#${active.id}` : ''}${active.className && typeof active.className === 'string' ? `.${active.className.split(' ').join('.')}` : ''}${active.getAttribute('aria-label') ? `[aria-label="${active.getAttribute('aria-label')}"]` : ''}`;
}
