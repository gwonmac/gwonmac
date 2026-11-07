/**
 * The Hub icon as a DOM node, for the renderer's own Hub pages (Hub preferences). The Hub's Vue
 * view draws the same icon from app/shared/ui/hub-icon.ts.
 */
import type { HubRow } from '../shared/hub.js';
import { hubIconKind, hubIconSvg } from '../shared/ui/hub-icon.js';

export function hubIcon(document: Document, row: Pick<HubRow, 'id' | 'group' | 'icon'>): HTMLElement {
  const icon = document.createElement('span'); icon.className = 'hub-icon'; icon.setAttribute('aria-hidden', 'true');
  if (row.icon) { const image = document.createElement('img'); image.src = row.icon; image.alt = ''; icon.append(image); return icon; }
  const kind = hubIconKind(row);
  icon.dataset.kind = kind;
  icon.innerHTML = hubIconSvg(kind);
  return icon;
}
