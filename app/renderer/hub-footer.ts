/**
 * Owns what the Hub's footer names, as pure functions of the page: the primary of a list row or
 * of a view, and the key legend. A running action keeps the primary: it names what runs,
 * disabled, until it ends (HUB-083). Only a primary that Enter runs carries the keycap. Nothing
 * here touches the DOM; hub.ts puts the results into its view model. Node tests hold these
 * rules (tests/unit/hub-footer.test.ts).
 */
import type { HubRow, HubViewAction } from '../shared/hub.js';
import { hubPrimaryArt, type HubLegendEntry, type HubPrimary } from '../shared/ui/hub-view.js';

/** A list page's primary: the selected row's action, or the running action's name. */
export function hubRowPrimary(row: HubRow | undefined, running: Readonly<{ label: string }> | null): HubPrimary {
  const art = running ? undefined : hubPrimaryArt(row);
  return { label: running ? running.label : row ? row.action : 'Select a result', ...(art ? { art } : {}), keycap: !!row && !running,
    disabled: !row || !!row.unavailable || !!running, variant: row?.destructive ? 'danger' : 'primary' };
}

/** A view's primary: the action it names, else its "Done"; Enter runs only a named one. */
export function hubViewPrimary(action: HubViewAction, named: boolean, running: boolean): HubPrimary {
  return { label: action.label, keycap: named && !running && !action.running,
    disabled: !!action.disabled || running || !!action.running, variant: action.destructive ? 'danger' : 'primary' };
}

export type HubLegendInput = Readonly<{
  /** A view is mounted: its own controls take the arrows. */
  view: boolean;
  rows: number;
  /** The selected row opens a page with →. */
  opens: boolean;
  running: boolean;
  /** The search this page types into holds text. */
  typed: boolean;
  /** Esc steps back to a page below this one. */
  parent: boolean;
  home: boolean;
}>;

/** The keys that act here and now, and nothing else. */
export function hubLegend(page: HubLegendInput): HubLegendEntry[] {
  const keys: HubLegendEntry[] = [];
  if (!page.view && page.rows > 1 && !page.running) keys.push([['↑', '↓'], 'Select']);
  if (!page.view && page.opens) keys.push([['→'], 'Open']);
  keys.push([['⎋'], page.typed ? 'Clear' : page.parent ? 'Back' : 'Close']);
  if (!page.home) keys.push([['⌘', '⌫'], 'Back']);
  return keys;
}
